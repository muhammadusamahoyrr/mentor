// Pure translation between the Anthropic message/tool shape the ReAct loop uses
// and the Gemini (@google/genai) shape. Kept separate and side-effect-free so it
// can be unit-tested without any SDK or network.

let counter = 0;
const nextId = () => `gemini-tool-${Date.now()}-${counter++}`;

// Anthropic tools [{name, description, input_schema}] -> Gemini tools config.
// Gemini's FunctionDeclaration accepts a raw JSON schema via parametersJsonSchema.
function toGeminiTools(tools = []) {
  if (!tools.length) return undefined;
  return [
    {
      functionDeclarations: tools.map((t) => ({
        name: t.name,
        description: t.description,
        parametersJsonSchema: t.input_schema,
      })),
    },
  ];
}

// Anthropic messages -> Gemini `contents`. Roles: user->user, assistant->model.
// tool_use -> functionCall part; tool_result -> functionResponse part (keyed by
// the function NAME, which Gemini needs — so we resolve id->name from the prior
// assistant turns).
function toGeminiContents(messages = []) {
  const idToName = {};
  for (const m of messages) {
    if (m.role === 'assistant' && Array.isArray(m.content)) {
      for (const b of m.content) if (b.type === 'tool_use') idToName[b.id] = b.name;
    }
  }

  return messages.map((m) => {
    const role = m.role === 'assistant' ? 'model' : 'user';

    if (typeof m.content === 'string') {
      return { role, parts: [{ text: m.content }] };
    }

    const parts = [];
    for (const b of m.content || []) {
      if (b.type === 'text') {
        parts.push({ text: b.text });
      } else if (b.type === 'tool_use') {
        parts.push({ functionCall: { name: b.name, args: b.input || {} } });
      } else if (b.type === 'tool_result') {
        let response;
        try {
          const parsed = JSON.parse(b.content);
          response =
            parsed && typeof parsed === 'object' && !Array.isArray(parsed)
              ? parsed
              : { result: parsed };
        } catch {
          response = { result: String(b.content) };
        }
        parts.push({
          functionResponse: { name: idToName[b.tool_use_id] || 'unknown', response },
        });
      }
    }
    return { role, parts };
  });
}

// Gemini result (text + functionCalls) -> Anthropic-shaped message the loop reads.
function toAnthropicMessage({ text, functionCalls = [] } = {}) {
  const content = [];
  if (text) content.push({ type: 'text', text });

  // De-dupe (a streamed response can surface the same call more than once).
  const seen = new Set();
  for (const fc of functionCalls) {
    const key = `${fc.name}:${JSON.stringify(fc.args || {})}`;
    if (seen.has(key)) continue;
    seen.add(key);
    content.push({ type: 'tool_use', id: nextId(), name: fc.name, input: fc.args || {} });
  }

  const hasCall = content.some((b) => b.type === 'tool_use');
  return { content, stop_reason: hasCall ? 'tool_use' : 'end_turn' };
}

module.exports = { toGeminiTools, toGeminiContents, toAnthropicMessage };
