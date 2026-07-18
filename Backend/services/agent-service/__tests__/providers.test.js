const { resolveProvider, defaultModel } = require('../src/agent/providers');
const {
  toGeminiTools,
  toGeminiContents,
  toAnthropicMessage,
} = require('../src/agent/providers/translate');
const { GeminiClient } = require('../src/agent/providers/gemini');
const { runAgent } = require('../src/agent/loop');

// A fake @google/genai instance: scripts responses with .text and .functionCalls.
function fakeGenai(script) {
  let i = 0;
  const requests = [];
  return {
    requests,
    models: {
      generateContent: async (req) => {
        requests.push(req);
        return script[i++];
      },
      generateContentStream: async (req) => {
        requests.push(req);
        const r = script[i++];
        return (async function* () {
          yield { text: r.text, functionCalls: r.functionCalls };
        })();
      },
    },
  };
}

describe('provider selection', () => {
  const saved = {};
  beforeEach(() => {
    for (const k of ['AGENT_PROVIDER', 'ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'GEMINI_MODEL', 'AGENT_MODEL']) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });
  afterEach(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it('honours an explicit AGENT_PROVIDER', () => {
    process.env.AGENT_PROVIDER = 'gemini';
    expect(resolveProvider()).toBe('gemini');
    process.env.AGENT_PROVIDER = 'anthropic';
    expect(resolveProvider()).toBe('anthropic');
  });

  it('auto-detects from whichever key is present (Anthropic wins)', () => {
    process.env.GEMINI_API_KEY = 'g';
    expect(resolveProvider()).toBe('gemini');
    process.env.ANTHROPIC_API_KEY = 'a';
    expect(resolveProvider()).toBe('anthropic');
  });

  it('defaults to anthropic and picks the right default model per provider', () => {
    expect(resolveProvider()).toBe('anthropic');
    expect(defaultModel('gemini')).toBe('gemini-2.5-flash');
    expect(defaultModel('anthropic')).toBe('claude-sonnet-5');
  });
});

describe('Anthropic <-> Gemini translation', () => {
  it('maps tools to functionDeclarations with the raw JSON schema', () => {
    const tools = [{ name: 'web_search', description: 'search', input_schema: { type: 'object', properties: {} } }];
    const g = toGeminiTools(tools);
    expect(g[0].functionDeclarations[0]).toMatchObject({
      name: 'web_search',
      parametersJsonSchema: { type: 'object' },
    });
  });

  it('maps a full tool-using conversation, resolving tool_result -> functionResponse by name', () => {
    const contents = toGeminiContents([
      { role: 'user', content: 'hi' },
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'ok' },
          { type: 'tool_use', id: 't1', name: 'read_file', input: { filename: 'x' } },
        ],
      },
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't1', content: '{"text":"hello"}' }] },
    ]);
    expect(contents[0]).toEqual({ role: 'user', parts: [{ text: 'hi' }] });
    expect(contents[1].role).toBe('model');
    expect(contents[1].parts).toContainEqual({ functionCall: { name: 'read_file', args: { filename: 'x' } } });
    expect(contents[2].parts[0].functionResponse).toEqual({ name: 'read_file', response: { text: 'hello' } });
  });

  it('turns a Gemini result into an Anthropic-shaped message (and de-dupes calls)', () => {
    const msg = toAnthropicMessage({
      text: 'here',
      functionCalls: [
        { name: 'f', args: { a: 1 } },
        { name: 'f', args: { a: 1 } }, // duplicate
      ],
    });
    expect(msg.stop_reason).toBe('tool_use');
    expect(msg.content.filter((b) => b.type === 'tool_use')).toHaveLength(1);
    expect(msg.content[0]).toEqual({ type: 'text', text: 'here' });

    expect(toAnthropicMessage({ text: 'done', functionCalls: [] }).stop_reason).toBe('end_turn');
  });
});

describe('GeminiClient adapter', () => {
  it('create() returns an Anthropic-shaped tool_use message', async () => {
    const client = new GeminiClient({
      genai: fakeGenai([{ text: '', functionCalls: [{ name: 'read_file', args: { filename: 'x' } }] }]),
    });
    const resp = await client.messages.create({ model: 'gemini-2.5-flash', system: 's', tools: [], messages: [{ role: 'user', content: 'hi' }] });
    expect(resp.stop_reason).toBe('tool_use');
    expect(resp.content.find((b) => b.type === 'tool_use').name).toBe('read_file');
  });

  it('stream() emits text deltas and returns a final message', async () => {
    const client = new GeminiClient({ genai: fakeGenai([{ text: 'hola mundo', functionCalls: [] }]) });
    const s = client.messages.stream({ model: 'gemini-2.5-flash', system: 's', tools: [], messages: [{ role: 'user', content: 'hi' }] });
    const chunks = [];
    s.on('text', (t) => chunks.push(t));
    const final = await s.finalMessage();
    expect(chunks.join('')).toBe('hola mundo');
    expect(final.stop_reason).toBe('end_turn');
  });
});

describe('the ReAct loop runs end-to-end on Gemini', () => {
  it('drives a tool call through the Gemini adapter and returns the answer', async () => {
    const genai = fakeGenai([
      { text: '', functionCalls: [{ name: 'read_file', args: { filename: 'sample.txt' } }] },
      { text: 'The file says hello. Sources: sample.txt', functionCalls: [] },
    ]);
    const client = new GeminiClient({ genai });

    const { answer, steps, stopReason } = await runAgent({ question: 'What does sample.txt say?', client });

    expect(answer).toContain('hello');
    expect(steps).toBe(2);
    expect(stopReason).toBe('end_turn');

    // the tools were translated into functionDeclarations...
    expect(genai.requests[0].config.tools[0].functionDeclarations.some((d) => d.name === 'read_file')).toBe(true);
    // ...and the tool result was fed back as a functionResponse for read_file
    const fedBack = genai.requests[1].contents.some((c) =>
      (c.parts || []).some((p) => p.functionResponse && p.functionResponse.name === 'read_file')
    );
    expect(fedBack).toBe(true);
  });
});
