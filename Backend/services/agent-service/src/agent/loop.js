// The ReAct loop — planner (Claude) → executor (skills) → observation, repeated
// until the model stops calling tools. This is the "planner → executor → memory
// loop" at the heart of an agent.
const registry = require('./tools/registry');
const { buildSystemPrompt } = require('./systemPrompt');
const { isThinResult } = require('./confidence');
const { createClient, defaultModel } = require('./providers');

const MAX_STEPS = Number(process.env.AGENT_MAX_STEPS || 6); // guardrail: cap tool loops so a runaway can't burn the budget
const MAX_TOKENS = 2048;

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
 * @returns {Promise<{ answer, steps, stopReason, toolOutcomes }>}
 */
async function runAgent({ question, history = [], ctx = {}, hook, client, model, language }) {
  const llm = client || createClient();
  const useModel = model || defaultModel();
  const system = buildSystemPrompt({ language });
  const messages = [...history, { role: 'user', content: question }];
  const toolOutcomes = []; // {name, thin} — feeds confidence grounding

  for (let step = 1; step <= MAX_STEPS; step++) {
    const response = await llm.messages.create({
      model: useModel,
      max_tokens: MAX_TOKENS,
      system,
      tools: registry.definitions,
      messages,
    });

    messages.push({ role: 'assistant', content: response.content });

    if (response.stop_reason !== 'tool_use') {
      return { answer: textOf(response.content), steps: step, stopReason: response.stop_reason, toolOutcomes };
    }

    // Execute every tool the model asked for this turn, each through the hook.
    const toolResults = [];
    for (const block of response.content) {
      if (block.type !== 'tool_use') continue;

      const handler = registry.handlers[block.name];
      const run = () =>
        handler
          ? handler(block.input, ctx)
          : Promise.reject(new Error(`Unknown skill: ${block.name}`));

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
    steps: MAX_STEPS,
    stopReason: 'max_steps',
    toolOutcomes,
  };
}

// Suppress the trailing "CONFIDENCE: <level>" marker from a streamed token feed,
// while holding back a small tail so the marker can't slip through split across
// two deltas. Returns { push(delta), flush() } that call emit() with clean text.
function markerFilter(emitToken) {
  const TAIL = 14; // >= length of "\nCONFIDENCE:"
  let pending = '';
  let hit = false;
  return {
    push(delta) {
      if (hit) return;
      pending += delta;
      const m = pending.search(/\n?\s*CONFIDENCE:/i);
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
  model,
  language,
  emit = () => {},
}) {
  const llm = client || createClient();
  const useModel = model || defaultModel();
  const system = buildSystemPrompt({ language });
  const messages = [...history, { role: 'user', content: question }];
  const toolOutcomes = [];

  for (let step = 1; step <= MAX_STEPS; step++) {
    const stream = llm.messages.stream({
      model: useModel,
      max_tokens: MAX_TOKENS,
      system,
      tools: registry.definitions,
      messages,
    });

    // Fresh marker filter per turn; only the final turn carries the CONFIDENCE line.
    const filter = markerFilter((text) => emit('token', { text }));
    stream.on('text', (delta) => filter.push(delta));

    const final = await stream.finalMessage();
    filter.flush();
    messages.push({ role: 'assistant', content: final.content });

    if (final.stop_reason !== 'tool_use') {
      return { answer: textOf(final.content), steps: step, stopReason: final.stop_reason, toolOutcomes };
    }

    const toolResults = [];
    for (const block of final.content) {
      if (block.type !== 'tool_use') continue;

      const handler = registry.handlers[block.name];
      const run = () =>
        handler
          ? handler(block.input, ctx)
          : Promise.reject(new Error(`Unknown skill: ${block.name}`));

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
}

module.exports = { runAgent, runAgentStream, markerFilter, MAX_STEPS };
