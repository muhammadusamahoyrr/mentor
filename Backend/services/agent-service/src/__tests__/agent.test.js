const registry = require('../agent/tools/registry');
const readFile = require('../agent/tools/readFile');
const webSearch = require('../../../../shared/agent/tools/webSearch');
const { createToolLogger } = require('../hooks/toolLogger');
const { runAgent } = require('../agent/loop');

describe('skill registry', () => {
  it('registers web_search and read_file with valid schemas and no duplicate names', () => {
    const names = registry.definitions.map((d) => d.name);
    expect(names).toEqual(expect.arrayContaining(['web_search', 'read_file']));
    expect(new Set(names).size).toBe(names.length);
    for (const def of registry.definitions) {
      expect(def.input_schema.type).toBe('object');
      expect(typeof registry.handlers[def.name]).toBe('function');
    }
  });
});

describe('read_file skill', () => {
  it('reads a .txt document from the docs folder', async () => {
    const out = await readFile.handler({ filename: 'sample.txt' });
    expect(out.filename).toBe('sample.txt');
    expect(out.text).toContain('hello');
    expect(out.chars).toBeGreaterThan(0);
  });

  it('rejects unsupported file types', async () => {
    await expect(readFile.handler({ filename: 'notes.docx' })).rejects.toThrow(/Unsupported/);
  });

  it('blocks path traversal by stripping the path (cannot escape docs folder)', async () => {
    // basename("../../etc/passwd") => "passwd", which does not exist in fixtures,
    // so it fails with a not-found error, never a traversal read.
    await expect(readFile.handler({ filename: '../../secret.txt' })).rejects.toThrow();
  });
});

describe('web_search skill', () => {
  it('fails closed when BRAVE_API_KEY is absent', async () => {
    await expect(webSearch.handler({ query: 'anything' })).rejects.toThrow(/BRAVE_API_KEY/);
  });
});

describe('tool-call hook (toolLogger)', () => {
  it('records a timestamped entry and returns the wrapped result', async () => {
    const { hook, entries } = createToolLogger({ sessionId: 's1' });
    const result = await hook('demo', { a: 1 }, async () => ({ ok: true }));
    expect(result).toEqual({ ok: true });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ sessionId: 's1', tool: 'demo', ok: true });
    expect(typeof entries[0].ts).toBe('string');
    expect(entries[0].ms).toBeGreaterThanOrEqual(0);
  });

  it('logs failures (ok:false) and rethrows', async () => {
    const { hook, entries } = createToolLogger({ sessionId: 's2' });
    await expect(
      hook('boom', {}, async () => {
        throw new Error('nope');
      })
    ).rejects.toThrow('nope');
    expect(entries[0].ok).toBe(false);
  });

  it('redacts long string arguments', async () => {
    const { hook, entries } = createToolLogger({});
    await hook('demo', { blob: 'x'.repeat(500) }, async () => 1);
    expect(entries[0].args.blob.length).toBeLessThan(500);
  });
});

// A fake Anthropic client that returns a scripted sequence of responses, so the
// ReAct loop can be tested end-to-end with zero network calls.
function fakeClient(script) {
  let i = 0;
  const calls = [];
  return {
    _calls: calls,
    messages: {
      create: async (params) => {
        calls.push(params);
        return script[i++];
      },
    },
  };
}

describe('ReAct loop', () => {
  it('executes a tool the model requests, logs it via the hook, then returns the final answer', async () => {
    const client = fakeClient([
      {
        stop_reason: 'tool_use',
        content: [
          { type: 'text', text: 'Let me read the report.' },
          { type: 'tool_use', id: 'tu1', name: 'read_file', input: { filename: 'sample.txt' } },
        ],
      },
      {
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: 'The report contains "hello". Sources: sample.txt' }],
      },
    ]);
    const { hook, entries } = createToolLogger({ sessionId: 'loop' });

    const { answer, steps, stopReason } = await runAgent({
      question: 'What does sample.txt say?',
      hook,
      client,
    });

    expect(answer).toContain('hello');
    expect(steps).toBe(2);
    expect(stopReason).toBe('end_turn');

    // The hook logged exactly the one tool call.
    expect(entries.map((e) => e.tool)).toEqual(['read_file']);

    // The loop fed the tool result back to the model on the second turn.
    const secondTurnMessages = client._calls[1].messages;
    const toolResult = secondTurnMessages
      .flatMap((m) => (Array.isArray(m.content) ? m.content : []))
      .find((b) => b.type === 'tool_result');
    expect(toolResult).toMatchObject({ tool_use_id: 'tu1', is_error: false });
  });

  it('surfaces a skill error to the model as an is_error tool_result instead of crashing', async () => {
    const client = fakeClient([
      {
        stop_reason: 'tool_use',
        content: [{ type: 'tool_use', id: 'tu1', name: 'read_file', input: { filename: 'nope.docx' } }],
      },
      { stop_reason: 'end_turn', content: [{ type: 'text', text: 'That file type is not supported.' }] },
    ]);

    const { answer } = await runAgent({ question: 'read nope.docx', client });
    expect(answer).toContain('not supported');

    const toolResult = client._calls[1].messages
      .flatMap((m) => (Array.isArray(m.content) ? m.content : []))
      .find((b) => b.type === 'tool_result');
    expect(toolResult.is_error).toBe(true);
    expect(toolResult.content).toContain('Unsupported');
  });
});
