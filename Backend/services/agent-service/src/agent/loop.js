// The ReAct loop — planner (Claude) → executor (skills) → observation, repeated
// until the model stops calling tools. This is the "planner → executor → memory
// loop" at the heart of an agent.
//
// The executor half is reached through a tool GATEWAY rather than a direct
// registry import, so the same loop runs the skills in-process or over MCP
// without knowing the difference — see ./tools/gateway.js.
const gateway = require('./tools/gateway');
const { buildSystemPrompt } = require('./systemPrompt');
const { isThinResult } = require('./confidence');
const { createClient, defaultModel } = require('./providers/factory');
const { emptyUsage, addUsage, summarize } = require('./providers/usage');

// Guardrail: cap tool loops so a runaway can't burn the budget. 10, not 6 — the
// first live run spent all six steps on progressively refined web searches and
// returned "reached the maximum number of reasoning steps" instead of an answer.
const MAX_STEPS = Number(process.env.AGENT_MAX_STEPS || 10);
// 4096, not 2048: a multi-source research answer plus its AGENT_META trailer
// overran 2048 in real use, and the cut landed mid-trailer — costing the sources
// and the confidence level. The trailer is the LAST thing generated, so it is
// always the first casualty of a tight budget.
const MAX_TOKENS = Number(process.env.AGENT_MAX_TOKENS || 4096);

const textOf = (content) =>
  content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();

/**
 * Run the agent to a final answer.
 *
 * @param {object}   opts
 * @param {string}   opts.question
 * @param {object[]} [opts.history]  prior messages (in-context memory) to prepend
 * @param {object}   [opts.ctx]      passed to every skill handler (e.g. { token, userId })
 * @param {function} [opts.hook]     (name, input, run) => result — the tool-call hook
 * @param {string}   [opts.language] respond in this language (safety rules preserved)
 * @param {object}   [opts.client]   injectable Anthropic client (tests)
 * @param {object}   [opts.tools]    injectable tool gateway (tests); defaults to
 *                                   the configured backend (MCP or in-process)
 * @returns {Promise<{ answer, steps, stopReason, toolOutcomes }>}
 */
async function runAgent({
  question,
  history = [],
  ctx = {},
  hook,
  client,
  tools,
  model,
  language,
  system: systemOverride,
  maxSteps,
}) {
  const llm = client || createClient();
  const useModel = model || defaultModel();
  const system = systemOverride || buildSystemPrompt({ language });
  const messages = [...history, { role: 'user', content: question }];
  const toolOutcomes = []; // {name, thin} — feeds confidence grounding
  const usage = emptyUsage(); // token accounting — approximate, see providers/usage.js

  const skills = tools || (await gateway.open(ctx));
  const ownsSkills = !tools; // only close what we opened
  // A worker gets a tighter budget than the top-level agent — see the budget
  // guard in orchestration/supervisor.js.
  const limit = Number(maxSteps) > 0 ? Number(maxSteps) : MAX_STEPS;

  try {
    for (let step = 1; step <= limit; step++) {
      const response = await llm.messages.create({
        model: useModel,
        max_tokens: MAX_TOKENS,
        system,
        tools: skills.definitions,
        messages,
      });

      addUsage(usage, response);
      messages.push({ role: 'assistant', content: response.content });

      if (response.stop_reason !== 'tool_use') {
        return {
          answer: textOf(response.content),
          steps: step,
          stopReason: response.stop_reason,
          toolOutcomes,
          usage: summarize(usage),
        };
      }

      // Execute every tool the model asked for this turn, each through the hook.
      const toolResults = [];
      for (const block of response.content) {
        if (block.type !== 'tool_use') continue;

        const run = () => skills.call(block.name, block.input, ctx);

        let content;
        let isError = false;
        try {
          const result = hook ? await hook(block.name, block.input, run) : await run();
          content = JSON.stringify(result);
          toolOutcomes.push({ name: block.name, thin: isThinResult(block.name, result) });
        } catch (err) {
          content = JSON.stringify({ error: err.message });
          isError = true;
          toolOutcomes.push({ name: block.name, thin: true });
        }

        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content, is_error: isError });
      }

      messages.push({ role: 'user', content: toolResults });
    }

    return {
      answer: '(Stopped: reached the maximum number of reasoning steps without a final answer.)',
      steps: limit,
      stopReason: 'max_steps',
      toolOutcomes,
      usage: summarize(usage),
    };
  } finally {
    if (ownsSkills) await skills.close?.();
  }
}

// Suppress the machine-readable trailer from a streamed token feed, while holding
// back a small tail so the marker can't slip through split across two deltas.
// Returns { push(delta), flush() } that call emit() with clean text.
//
// Two markers are recognised: the AGENT_META trailer (sources + confidence, see
// answerSchema.js) and the older bare CONFIDENCE line, which is still the
// fallback when a model fails to produce a valid trailer. Neither may ever reach
// the doctor's screen.
function markerFilter(emitToken) {
  const TAIL = 16; // >= length of "\nAGENT_META:" and "\nCONFIDENCE:"
  let pending = '';
  let hit = false;
  return {
    push(delta) {
      if (hit) return;
      pending += delta;
      const m = pending.search(/\n?\s*(AGENT_META|CONFIDENCE)\s*:/i);
      if (m !== -1) {
        if (pending.slice(0, m)) emitToken(pending.slice(0, m));
        hit = true;
        pending = '';
        return;
      }
      if (pending.length > TAIL) {
        const safe = pending.slice(0, -TAIL);
        emitToken(safe);
        pending = pending.slice(safe.length);
      }
    },
    flush() {
      if (!hit && pending) emitToken(pending);
      pending = '';
    },
  };
}

/**
 * Streaming variant of runAgent. Calls `emit(event, data)` as things happen:
 *   emit('token', { text }) — a text delta (CONFIDENCE marker stripped)
 *   emit('tool',  { phase:'start'|'end', tool, ... })
 * Returns the same shape as runAgent once the loop settles.
 */
async function runAgentStream({
  question,
  history = [],
  ctx = {},
  hook,
  client,
  tools,
  model,
  language,
  emit = () => {},
}) {
  const llm = client || createClient();
  const useModel = model || defaultModel();
  const system = buildSystemPrompt({ language });
  const messages = [...history, { role: 'user', content: question }];
  const toolOutcomes = [];
  const usage = emptyUsage();

  const skills = tools || (await gateway.open(ctx));
  const ownsSkills = !tools;

  try {
    for (let step = 1; step <= MAX_STEPS; step++) {
      const stream = llm.messages.stream({
        model: useModel,
        max_tokens: MAX_TOKENS,
        system,
        tools: skills.definitions,
        messages,
      });

      // Fresh marker filter per turn; only the final turn carries the trailer.
      const filter = markerFilter((text) => emit('token', { text }));
      stream.on('text', (delta) => filter.push(delta));

      const final = await stream.finalMessage();
      filter.flush();
      addUsage(usage, final);
      messages.push({ role: 'assistant', content: final.content });

      if (final.stop_reason !== 'tool_use') {
        return {
          answer: textOf(final.content),
          steps: step,
          stopReason: final.stop_reason,
          toolOutcomes,
          usage: summarize(usage),
        };
      }

      const toolResults = [];
      for (const block of final.content) {
        if (block.type !== 'tool_use') continue;

        const run = () => skills.call(block.name, block.input, ctx);

        emit('tool', { phase: 'start', tool: block.name, args: block.input });
        const t0 = Date.now();
        let content;
        let isError = false;
        try {
          const result = hook ? await hook(block.name, block.input, run) : await run();
          content = JSON.stringify(result);
          toolOutcomes.push({ name: block.name, thin: isThinResult(block.name, result) });
        } catch (err) {
          content = JSON.stringify({ error: err.message });
          isError = true;
          toolOutcomes.push({ name: block.name, thin: true });
        }
        emit('tool', { phase: 'end', tool: block.name, ok: !isError, ms: Date.now() - t0 });

        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content, is_error: isError });
      }

      messages.push({ role: 'user', content: toolResults });
    }

    return {
      answer: '(Stopped: reached the maximum number of reasoning steps without a final answer.)',
      steps: MAX_STEPS,
      stopReason: 'max_steps',
      toolOutcomes,
    };
  } finally {
    if (ownsSkills) await skills.close?.();
  }
}

module.exports = { runAgent, runAgentStream, markerFilter, MAX_STEPS };
