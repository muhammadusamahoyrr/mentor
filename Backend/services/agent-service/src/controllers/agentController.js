const crypto = require('crypto');
const { asyncHandler } = require('../../../../shared/middleware/errorHandler');
const trace = require('../../../../shared/trace/traceStore');
const { runAgent, runAgentStream } = require('../agent/loop');
const { runSupervisor } = require('../agent/orchestration/supervisor');
const { createToolLogger } = require('../hooks/toolLogger');
const { kafkaSink } = require('../events/auditSink');
const { traceSink, note, fanout } = require('../events/traceSink');
const { parseConfidence, resolveConfidence, LOW_PREFIX } = require('../agent/confidence');
const { parseAnswer, repairMessages } = require('../agent/answerSchema');
const { createClient, defaultModel } = require('../agent/providers/factory');
const memory = require('../memory/session');

// Ask the model once more for just the trailer. Best-effort: if the repair call
// itself fails (rate limit, network), we fall through to the legacy path rather
// than failing the doctor's question over a metadata line.
async function repairTrailer(answer, error, { client, model }) {
  try {
    const llm = client || createClient();
    const response = await llm.messages.create({
      model: model || defaultModel(),
      max_tokens: 512,
      messages: repairMessages(answer, error),
    });
    const text = (response.content || [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n');
    // Re-attach to the prose so the same parser handles it.
    return parseAnswer(`${answer}\n${text.trim()}`);
  } catch {
    return { answer, meta: null, ok: false, error: 'repair call failed' };
  }
}

/**
 * Turn a raw loop result into the final answer + confidence + sources.
 *
 * Order of preference:
 *   1. a valid AGENT_META trailer (sources + confidence)
 *   2. one repair retry asking only for the trailer
 *   3. the legacy bare "CONFIDENCE:" line, with no sources
 *
 * Whichever supplies the level, the GROUNDING FLOOR still applies on top: if the
 * agent leaned on retrieval and it came back thin, confidence is forced down. A
 * model asserting "high" over no evidence is exactly the failure this guards.
 */
async function finalizeAnswer(result, hook, opts = {}) {
  let parsed = parseAnswer(result.answer);
  let repaired = false;

  // The repair costs one extra model call. That is usually worth it, but on a
  // rate-limited free tier a question already spends several calls, so it can be
  // switched off (AGENT_TRAILER_REPAIR=0) — we then fall straight through to the
  // legacy CONFIDENCE line rather than risking a 429 on the doctor's question.
  const repairEnabled = process.env.AGENT_TRAILER_REPAIR !== '0';

  if (!parsed.ok && repairEnabled) {
    const attempt = await repairTrailer(parsed.answer, parsed.error, opts);
    if (attempt.ok) {
      parsed = attempt;
      repaired = true;
    }
  }

  let modelLevel;
  let sources = [];
  let clean;

  if (parsed.ok) {
    modelLevel = parsed.meta.confidence;
    sources = parsed.meta.sources;
    // Even with a valid trailer, models often ALSO write a prose
    // "Confidence: Medium (…)" line — which then appears above the badge saying
    // the same thing. Strip it here too; the level from the trailer still wins.
    clean = parseConfidence(parsed.answer).answer;
  } else {
    // Legacy fallback: a bare CONFIDENCE line, or nothing at all.
    const legacy = parseConfidence(parsed.answer);
    clean = legacy.answer;
    modelLevel = legacy.level;
  }

  const confidence = resolveConfidence(modelLevel, result.toolOutcomes);
  let answer = clean;
  if (confidence === 'low') {
    answer = LOW_PREFIX + clean;
    await hook('confidence_assessment', { level: confidence, modelLevel }, async () => ({
      level: confidence,
    }));
  }

  return { answer, confidence, sources, trailerRepaired: repaired, trailerValid: parsed.ok };
}

// Single agent by default. AGENT_MODE=supervisor turns on orchestration —
// opt-in because it costs several times more model calls per question and,
// as week5.md says plainly, does not automatically produce a better answer.
const orchestrating = () => (process.env.AGENT_MODE || 'single').toLowerCase() === 'supervisor';

// POST /api/agent/ask — run the ReAct loop to a final answer.
// Content-negotiated: `Accept: text/event-stream` streams tokens and live tool
// events over SSE (for the dashboard panel); otherwise a single JSON response.
exports.ask = asyncHandler(async (req, res) => {
  const { question, sessionId: sid, language: lang } = req.body || {};

  if (!question || typeof question !== 'string') {
    return res.status(400).json({ error: 'A non-empty "question" string is required' });
  }

  const language = typeof lang === 'string' && lang.trim() ? lang.trim() : undefined;
  const sessionId = sid || crypto.randomUUID();
  // One id for this run, propagated to the MCP server on every tool call so the
  // steps executed over there file under the same trace as the planning here.
  const runId = crypto.randomUUID();

  // In-context memory: replay this session's prior Q/A so the agent recalls facts
  // established earlier in the conversation.
  const session = await memory.recall(sessionId);

  // The Hook: log every tool call with timestamps, publish each to Kafka (the
  // durable audit trail) AND to the trace store (the live view). The caller's own
  // token gates every skill.
  const { hook, entries } = createToolLogger({
    sessionId,
    onEvent: fanout(kafkaSink(), traceSink(runId)),
  });

  const ctx = { token: req.token, userId: req.user.id, runId };

  await note(runId, {
    type: 'run',
    phase: 'start',
    sessionId,
    userId: req.user.id, // scopes who may later read this trace
    question,
    language: language || null,
    model: defaultModel(),
  });

  const wantsStream = (req.headers.accept || '').includes('text/event-stream');

  if (wantsStream) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // don't let a proxy buffer the stream
    if (res.flushHeaders) res.flushHeaders();

    const send = (event, data) => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    send('session', { sessionId, runId, mode: orchestrating() ? 'supervisor' : 'single' });
    try {
      // Both paths return the same shape, so everything downstream — the
      // trailer, confidence, memory, trace — is identical either way.
      const run = orchestrating() ? runSupervisor : runAgentStream;
      const result = await run({
        question,
        history: session.history,
        ctx,
        hook,
        language,
        // Mirror every orchestration step into the trace as well as the panel,
        // so the trace spans the whole agent graph and not just tool calls.
        emit: (event, data) => {
          send(event, data);
          if (event === 'step') {
            note(runId, { type: 'step', agent: data.agent, ...data }).catch(() => {});
          }
        },
      });
      const { answer, confidence, sources } = await finalizeAnswer(result, hook);
      await memory.appendTurn(sessionId, question, answer, { ownerId: req.user.id });
      await note(runId, {
        type: 'run',
        phase: 'end',
        confidence,
        sources: sources.length,
        steps: result.steps,
        stopReason: result.stopReason,
        orchestration: result.orchestration || null,
      });
      send('done', {
        sessionId,
        runId,
        answer,
        confidence,
        sources,
        steps: result.steps,
        stopReason: result.stopReason,
        tools: entries,
        // Per-worker timings for the cost/latency story (§4.6).
        orchestration: result.orchestration || null,
      });
    } catch (err) {
      await note(runId, { type: 'run', phase: 'error', error: err.message });
      send('error', { error: err.message });
    }
    return res.end();
  }

  // Non-streaming: the supervisor still works, its token events simply go nowhere.
  const result = orchestrating()
    ? await runSupervisor({
        question,
        history: session.history,
        ctx,
        hook,
        language,
        emit: (event, data) => {
          if (event === 'step') note(runId, { type: 'step', agent: data.agent, ...data }).catch(() => {});
        },
      })
    : await runAgent({
        question,
        history: session.history,
        ctx,
        hook,
        language,
      });

  const { answer, confidence, sources } = await finalizeAnswer(result, hook);
  await memory.appendTurn(sessionId, question, answer, { ownerId: req.user.id });
  await note(runId, {
    type: 'run',
    phase: 'end',
    confidence,
    sources: sources.length,
    steps: result.steps,
    stopReason: result.stopReason,
    orchestration: result.orchestration || null,
  });

  res.json({
    sessionId,
    runId,
    answer,
    confidence,
    sources,
    steps: result.steps,
    stopReason: result.stopReason,
    orchestration: result.orchestration || null,
    tools: entries, // the timestamped tool-call log for this request
    memory: {
      backedByRedis: memory.isBackedByRedis(),
      priorTurns: Math.floor((session.history || []).length / 2),
    },
  });
});

// GET /api/agent/sessions/:id — inspect what the agent remembers for a session.
exports.getSession = asyncHandler(async (req, res) => {
  const session = await memory.recall(req.params.id);

  // Session ids are unguessable, but scope reads to the owner anyway: one doctor
  // must never read another's agent session.
  if (session.ownerId && session.ownerId !== req.user.id) {
    return res.status(403).json({ error: 'Not your session' });
  }

  res.json({
    sessionId: req.params.id,
    backedByRedis: memory.isBackedByRedis(),
    history: session.history || [],
    facts: session.facts || [],
    updatedAt: session.updatedAt || null,
  });
});

// GET /api/agent/traces/:runId — the step tree for one run: what the planner did
// here and what the tools did inside the MCP server, merged in order.
exports.getTrace = asyncHandler(async (req, res) => {
  const { runId } = req.params;
  const steps = await trace.get(runId);

  if (!steps.length) {
    return res.status(404).json({ error: 'No trace for that run (it may have expired)' });
  }

  // The run-start step records who asked. Scope reads to them, exactly as with
  // sessions: a trace contains the question and the documents touched.
  const start = steps.find((s) => s.type === 'run' && s.phase === 'start');
  if (start?.userId && start.userId !== req.user.id) {
    return res.status(403).json({ error: 'Not your run' });
  }

  res.json({
    runId,
    backedByRedis: trace.isBackedByRedis(),
    // Honest about the split: without Redis the two processes keep separate
    // in-memory stores, so a trace may only show this service's half.
    services: [...new Set(steps.map((s) => s.service))],
    steps,
  });
});
