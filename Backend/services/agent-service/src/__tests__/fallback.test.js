// The provider fallback chain and the OpenRouter translation layer. No network:
// the chain is driven with fake clients, and the translation is pure.
const { createFallbackClient, isWorthRetrying } = require('../agent/providers/fallback');
const {
  toOpenAITools,
  toOpenAIMessages,
  toAnthropicMessage,
  mergeToolCallDeltas,
} = require('../agent/providers/openrouterTranslate');
const { resolveProviderChain, defaultModel } = require('../agent/providers/factory');

const httpError = (status) => Object.assign(new Error(`boom ${status}`), { status });

// A fake provider client. `behaviour` is called per attempt.
function fakeClient(behaviour) {
  return {
    messages: {
      create: async (params) => behaviour({ params, streaming: false }),
      stream: (params) => {
        let textCb = () => {};
        return {
          on(e, cb) {
            if (e === 'text') textCb = cb;
            return this;
          },
          finalMessage: () => behaviour({ params, streaming: true, emit: textCb }),
        };
      },
    },
  };
}

const link = (provider, model, behaviour) => ({ provider, model, client: fakeClient(behaviour) });

const ok = (text) => async () => ({ content: [{ type: 'text', text }], stop_reason: 'end_turn' });

describe('isWorthRetrying', () => {
  it('retries rate limits, server errors and network failures', () => {
    expect(isWorthRetrying(httpError(429))).toBe(true);
    expect(isWorthRetrying(httpError(500))).toBe(true);
    expect(isWorthRetrying(httpError(503))).toBe(true);
    expect(isWorthRetrying(new Error('ECONNREFUSED'))).toBe(true); // no status
  });

  it('retries a misconfigured provider (bad or missing key)', () => {
    expect(isWorthRetrying(httpError(401))).toBe(true);
    expect(isWorthRetrying(httpError(403))).toBe(true);
  });

  it('does NOT retry a request WE got wrong — every provider would reject it', () => {
    expect(isWorthRetrying(httpError(400))).toBe(false);
    expect(isWorthRetrying(httpError(422))).toBe(false);
  });
});

describe('fallback chain — non-streaming', () => {
  it('uses the first provider when it works, and never calls the second', async () => {
    const second = jest.fn(ok('from second'));
    const client = createFallbackClient([
      link('gemini', 'gemini-2.5-flash', ok('from first')),
      link('openrouter', 'free-model', second),
    ]);

    const r = await client.messages.create({ messages: [] });
    expect(r.content[0].text).toBe('from first');
    expect(second).not.toHaveBeenCalled();
  });

  it('rolls over to the next provider on a rate limit', async () => {
    const client = createFallbackClient([
      link('gemini', 'gemini-2.5-flash', async () => {
        throw httpError(429);
      }),
      link('openrouter', 'free-model', ok('rescued')),
    ]);

    const r = await client.messages.create({ messages: [] });
    expect(r.content[0].text).toBe('rescued');
  });

  it('sends each provider ITS OWN model name, not the previous one', async () => {
    const seen = [];
    const record = (name, fail) => async ({ params }) => {
      seen.push({ provider: name, model: params.model });
      if (fail) throw httpError(429);
      return { content: [{ type: 'text', text: 'ok' }], stop_reason: 'end_turn' };
    };

    const client = createFallbackClient([
      link('gemini', 'gemini-2.5-flash', record('gemini', true)),
      link('openrouter', 'llama-free', record('openrouter', false)),
    ]);

    // The caller's model is deliberately overridden per link — "gemini-2.5-flash"
    // is meaningless to OpenRouter.
    await client.messages.create({ messages: [], model: 'gemini-2.5-flash' });
    expect(seen).toEqual([
      { provider: 'gemini', model: 'gemini-2.5-flash' },
      { provider: 'openrouter', model: 'llama-free' },
    ]);
  });

  it('does not waste a second call on a 400 — it fails immediately', async () => {
    const second = jest.fn(ok('never'));
    const client = createFallbackClient([
      link('gemini', 'g', async () => {
        throw httpError(400);
      }),
      link('openrouter', 'o', second),
    ]);

    await expect(client.messages.create({ messages: [] })).rejects.toThrow(/400/);
    expect(second).not.toHaveBeenCalled();
  });

  it('reports every provider that failed, not just the last one', async () => {
    const client = createFallbackClient([
      link('gemini', 'g', async () => {
        throw httpError(429);
      }),
      link('openrouter', 'o', async () => {
        throw httpError(500);
      }),
    ]);

    await expect(client.messages.create({ messages: [] })).rejects.toThrow(
      /All providers failed.*gemini.*429.*openrouter.*500/s
    );
  });

  it('exposes the chain it will try, for logging', () => {
    const client = createFallbackClient([
      link('gemini', 'gemini-2.5-flash', ok('x')),
      link('openrouter', 'llama-free', ok('y')),
    ]);
    expect(client.chain).toEqual([
      { provider: 'gemini', model: 'gemini-2.5-flash' },
      { provider: 'openrouter', model: 'llama-free' },
    ]);
  });
});

describe('fallback chain — streaming', () => {
  it('falls back when the first provider fails BEFORE emitting any token', async () => {
    const client = createFallbackClient([
      link('gemini', 'g', async () => {
        throw httpError(429); // failed before emitting
      }),
      link('openrouter', 'o', async ({ emit }) => {
        emit('rescued text');
        return { content: [{ type: 'text', text: 'rescued text' }], stop_reason: 'end_turn' };
      }),
    ]);

    const seen = [];
    const stream = client.messages.stream({ messages: [] });
    stream.on('text', (t) => seen.push(t));
    const final = await stream.finalMessage();

    expect(seen).toEqual(['rescued text']);
    expect(final.content[0].text).toBe('rescued text');
  });

  it('REFUSES to fall back once tokens have already reached the screen', async () => {
    // Switching now would replay a second, different answer on top of the first.
    const second = jest.fn(async () => ({ content: [], stop_reason: 'end_turn' }));
    const client = createFallbackClient([
      link('gemini', 'g', async ({ emit }) => {
        emit('half an answer');
        throw httpError(500); // died mid-stream
      }),
      link('openrouter', 'o', second),
    ]);

    const seen = [];
    const stream = client.messages.stream({ messages: [] });
    stream.on('text', (t) => seen.push(t));

    await expect(stream.finalMessage()).rejects.toThrow(/500/);
    expect(seen).toEqual(['half an answer']); // no duplicate text
    expect(second).not.toHaveBeenCalled();
  });
});

describe('resolveProviderChain', () => {
  const saved = { ...process.env };
  afterEach(() => {
    for (const k of ['AGENT_PROVIDERS', 'AGENT_PROVIDER', 'OPENROUTER_API_KEY', 'GEMINI_API_KEY']) {
      delete process.env[k];
    }
    Object.assign(process.env, saved);
  });

  it('honours an explicit ordered list', () => {
    process.env.AGENT_PROVIDERS = 'openrouter, gemini';
    expect(resolveProviderChain()).toEqual(['openrouter', 'gemini']);
  });

  it('ignores unknown names in the list', () => {
    process.env.AGENT_PROVIDERS = 'gemini,not-a-provider,openrouter';
    expect(resolveProviderChain()).toEqual(['gemini', 'openrouter']);
  });

  it('appends any OTHER provider that has a key, so a second key is all it takes', () => {
    delete process.env.AGENT_PROVIDERS;
    process.env.AGENT_PROVIDER = 'gemini';
    process.env.OPENROUTER_API_KEY = 'k';
    expect(resolveProviderChain()).toEqual(['gemini', 'openrouter']);
  });

  it('is a single provider when only the primary is configured', () => {
    delete process.env.AGENT_PROVIDERS;
    delete process.env.OPENROUTER_API_KEY;
    process.env.AGENT_PROVIDER = 'anthropic';
    expect(resolveProviderChain()).toEqual(['anthropic']);
  });

  it('gives OpenRouter a free model by default', () => {
    expect(defaultModel('openrouter')).toMatch(/:free$/);
  });
});

describe('OpenRouter translation (Anthropic <-> OpenAI shapes)', () => {
  it('converts tool definitions', () => {
    const [t] = toOpenAITools([
      { name: 'web_search', description: 'Search', input_schema: { type: 'object', properties: {} } },
    ]);
    expect(t).toMatchObject({
      type: 'function',
      function: { name: 'web_search', description: 'Search' },
    });
    expect(t.function.parameters.type).toBe('object');
  });

  it('puts the system prompt first', () => {
    const out = toOpenAIMessages([{ role: 'user', content: 'hi' }], 'be safe');
    expect(out[0]).toEqual({ role: 'system', content: 'be safe' });
    expect(out[1]).toEqual({ role: 'user', content: 'hi' });
  });

  it('turns an assistant tool_use into OpenAI tool_calls', () => {
    const [msg] = toOpenAIMessages([
      {
        role: 'assistant',
        content: [{ type: 'tool_use', id: 'tu1', name: 'web_search', input: { query: 'x' } }],
      },
    ]);
    expect(msg.role).toBe('assistant');
    expect(msg.content).toBeNull(); // tool-calls-only turn
    expect(msg.tool_calls[0]).toMatchObject({ id: 'tu1', function: { name: 'web_search' } });
    expect(JSON.parse(msg.tool_calls[0].function.arguments)).toEqual({ query: 'x' });
  });

  it('expands tool_result blocks into separate {role:tool} messages', () => {
    // The structural mismatch that matters: Anthropic nests results in a user
    // turn, OpenAI wants one top-level message per result.
    const out = toOpenAIMessages([
      {
        role: 'user',
        content: [
          { type: 'tool_result', tool_use_id: 'tu1', content: '{"ok":true}' },
          { type: 'tool_result', tool_use_id: 'tu2', content: '{"ok":false}' },
        ],
      },
    ]);
    expect(out).toEqual([
      { role: 'tool', tool_call_id: 'tu1', content: '{"ok":true}' },
      { role: 'tool', tool_call_id: 'tu2', content: '{"ok":false}' },
    ]);
  });

  it('converts an OpenAI reply back into the Anthropic shape', () => {
    const msg = toAnthropicMessage({
      content: 'Here you go',
      tool_calls: [{ id: 'c1', function: { name: 'read_patient_file', arguments: '{"fileId":"f1"}' } }],
    });
    expect(msg.stop_reason).toBe('tool_use');
    expect(msg.content[0]).toEqual({ type: 'text', text: 'Here you go' });
    expect(msg.content[1]).toMatchObject({
      type: 'tool_use',
      name: 'read_patient_file',
      input: { fileId: 'f1' },
    });
  });

  it('reports end_turn when the model just answered', () => {
    expect(toAnthropicMessage({ content: 'done' }).stop_reason).toBe('end_turn');
  });

  it('survives malformed tool arguments instead of throwing', () => {
    // The loop can then feed the skill's complaint back to the model.
    const msg = toAnthropicMessage({
      tool_calls: [{ id: 'c1', function: { name: 'web_search', arguments: '{not json' } }],
    });
    expect(msg.content[0].input).toEqual({});
  });

  it('reassembles tool calls streamed as fragments', () => {
    const acc = [];
    mergeToolCallDeltas(acc, [{ index: 0, id: 'c1', function: { name: 'web_search', arguments: '{"qu' } }]);
    mergeToolCallDeltas(acc, [{ index: 0, function: { arguments: 'ery":"x"}' } }]);

    expect(acc[0].id).toBe('c1');
    expect(JSON.parse(acc[0].function.arguments)).toEqual({ query: 'x' });
  });
});
