const crypto = require('crypto');
const { asyncHandler } = require('../../../../shared/middleware/errorHandler');
const { runAgent, runAgentStream } = require('../agent/loop');
const { createToolLogger } = require('../hooks/toolLogger');
const { kafkaSink } = require('../hooks/auditSink');
const { parseConfidence, resolveConfidence, LOW_PREFIX } = require('../agent/confidence');
const memory = require('../memory/session');

// Turn a raw loop result into the final answer + confidence. On low confidence,
// prepend the verify-with-doctor notice and log the assessment via the hook so
// it lands in the audit trail.
async function finalizeAnswer(result, hook) {
  const { level: modelLevel, answer: clean } = parseConfidence(result.answer);
  const confidence = resolveConfidence(modelLevel, result.toolOutcomes);
  let answer = clean;
  if (confidence === 'low') {
    answer = LOW_PREFIX + clean;
    await hook('confidence_assessment', { level: confidence, modelLevel }, async () => ({
      level: confidence,
    }));
  }
  return { answer, confidence };
}

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

  // In-context memory: replay this session's prior Q/A so the agent recalls facts
  // established earlier in the conversation.
  const session = await memory.recall(sessionId);

  // The Hook: log every tool call with timestamps, and publish each to Kafka
  // (audit-service persists them). The caller's own token gates every skill.
  const { hook, entries } = createToolLogger({ sessionId, onEvent: kafkaSink() });

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

    send('session', { sessionId });
    try {
      const result = await runAgentStream({
        question,
        history: session.history,
        ctx: { token: req.token, userId: req.user.id },
        hook,
        language,
        emit: send,
      });
      const { answer, confidence } = await finalizeAnswer(result, hook);
      await memory.appendTurn(sessionId, question, answer, { ownerId: req.user.id });
      send('done', {
        sessionId,
        answer,
        confidence,
        steps: result.steps,
        stopReason: result.stopReason,
        tools: entries,
      });
    } catch (err) {
      send('error', { error: err.message });
    }
    return res.end();
  }

  const result = await runAgent({
    question,
    history: session.history,
    ctx: { token: req.token, userId: req.user.id },
    hook,
    language,
  });

  const { answer, confidence } = await finalizeAnswer(result, hook);
  await memory.appendTurn(sessionId, question, answer, { ownerId: req.user.id });

  res.json({
    sessionId,
    answer,
    confidence,
    steps: result.steps,
    stopReason: result.stopReason,
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
