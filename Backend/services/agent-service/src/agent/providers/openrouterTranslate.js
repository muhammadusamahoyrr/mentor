// Pure translation between the Anthropic message/tool shape the ReAct loop uses
// and the OpenAI chat-completions shape that OpenRouter speaks. Kept separate and
// side-effect-free so it can be unit-tested without any SDK or network — the same
// split as translate.js does for Gemini.

// Anthropic tools [{name, description, input_schema}] -> OpenAI tools.
function toOpenAITools(tools = []) {
  if (!tools.length) return undefined;
  return tools.map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.input_schema,
    },
  }));
}

// Anthropic messages -> OpenAI `messages`.
//
// The shapes disagree in one structural way that matters: Anthropic carries tool
// RESULTS as blocks inside a `user` message, while OpenAI wants each result as
// its own top-level {role:'tool'} message keyed by tool_call_id. So one Anthropic
// message can expand into several OpenAI ones.
function toOpenAIMessages(messages = [], system) {
  const out = [];
  if (system) out.push({ role: 'system', content: system });

  for (const m of messages) {
    if (typeof m.content === 'string') {
      out.push({ role: m.role, content: m.content });
      continue;
    }

    const blocks = m.content || [];

    if (m.role === 'assistant') {
      const text = blocks
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('\n');
      const toolCalls = blocks
        .filter((b) => b.type === 'tool_use')
        .map((b) => ({
          id: b.id,
          type: 'function',
          function: { name: b.name, arguments: JSON.stringify(b.input || {}) },
        }));

      // OpenAI requires `content` to be present; null is the accepted value for
      // an assistant turn that is nothing but tool calls.
      const msg = { role: 'assistant', content: text || null };
      if (toolCalls.length) msg.tool_calls = toolCalls;
      out.push(msg);
      continue;
    }

    // user turn: tool results first (they answer the previous assistant turn),
    // then any actual user text.
    for (const b of blocks) {
      if (b.type !== 'tool_result') continue;
      out.push({
        role: 'tool',
        tool_call_id: b.tool_use_id,
        content: typeof b.content === 'string' ? b.content : JSON.stringify(b.content),
      });
    }
    const text = blocks
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n');
    if (text) out.push({ role: 'user', content: text });
  }

  return out;
}

// OpenAI response message -> the Anthropic-shaped message the loop reads.
// `usage` is the response-level usage block, passed through for token accounting.
function toAnthropicMessage(message = {}, usage) {
  const content = [];
  if (message.content) content.push({ type: 'text', text: message.content });

  for (const tc of message.tool_calls || []) {
    // A model can emit malformed JSON arguments. Leave `input` as {} rather than
    // throwing: the skill then rejects it and the loop feeds that error back to
    // the model, which is the recoverable path.
    let input = {};
    try {
      input = JSON.parse(tc.function?.arguments || '{}');
    } catch {
      /* keep the empty object */
    }
    content.push({
      type: 'tool_use',
      id: tc.id,
      name: tc.function?.name,
      input,
    });
  }

  const hasCall = content.some((b) => b.type === 'tool_use');
  const out = { content, stop_reason: hasCall ? 'tool_use' : 'end_turn' };
  if (usage) out.usage = usage;
  return out;
}

// Streamed tool calls arrive as fragments keyed by `index`: the id and name come
// once, then `arguments` accumulates a character at a time. Fold them back into
// whole tool calls.
function mergeToolCallDeltas(accumulator, deltas = []) {
  for (const d of deltas) {
    const i = d.index ?? 0;
    if (!accumulator[i]) {
      accumulator[i] = { id: '', type: 'function', function: { name: '', arguments: '' } };
    }
    if (d.id) accumulator[i].id = d.id;
    if (d.function?.name) accumulator[i].function.name = d.function.name;
    if (d.function?.arguments) accumulator[i].function.arguments += d.function.arguments;
  }
  return accumulator;
}

module.exports = { toOpenAITools, toOpenAIMessages, toAnthropicMessage, mergeToolCallDeltas };
