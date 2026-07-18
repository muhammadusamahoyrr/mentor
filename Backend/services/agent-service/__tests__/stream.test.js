const { runAgentStream } = require('../src/agent/loop');
const { createToolLogger } = require('../src/hooks/toolLogger');

// Fake streaming Anthropic client: each messages.stream() call returns a stream
// object whose finalMessage() replays text deltas (to the 'text' handler) then
// resolves the next scripted message.
function fakeStreamClient(script) {
  let i = 0;
  const calls = [];
  return {
    _calls: calls,
    messages: {
      stream: (params) => {
        calls.push(params);
        const msg = script[i++];
        const handlers = {};
        const s = {
          on: (event, cb) => {
            handlers[event] = cb;
            return s;
          },
          finalMessage: async () => {
            if (handlers.text && msg._deltas) msg._deltas.forEach((d) => handlers.text(d));
            return msg;
          },
        };
        return s;
      },
    },
  };
}

describe('runAgentStream', () => {
  it('emits token deltas and tool start/end events, runs the tool, and returns the answer', async () => {
    const client = fakeStreamClient([
      {
        stop_reason: 'tool_use',
        _deltas: ['Let ', 'me read.'],
        content: [
          { type: 'text', text: 'Let me read.' },
          { type: 'tool_use', id: 'tu1', name: 'read_file', input: { filename: 'sample.txt' } },
        ],
      },
      {
        stop_reason: 'end_turn',
        _deltas: ['The file ', 'says hello.'],
        content: [{ type: 'text', text: 'The file says hello. Sources: sample.txt' }],
      },
    ]);

    const events = [];
    const emit = (event, data) => events.push({ event, data });
    const { hook, entries } = createToolLogger({ sessionId: 'stream' });

    const { answer, steps, stopReason } = await runAgentStream({
      question: 'What does sample.txt say?',
      hook,
      client,
      emit,
    });

    expect(answer).toContain('hello');
    expect(steps).toBe(2);
    expect(stopReason).toBe('end_turn');

    // Token deltas were emitted.
    const tokens = events.filter((e) => e.event === 'token');
    expect(tokens.length).toBeGreaterThan(0);
    expect(tokens.map((t) => t.data.text).join('')).toContain('hello');

    // Tool start AND end were emitted for read_file, in that order.
    const toolEvents = events.filter((e) => e.event === 'tool');
    expect(toolEvents[0].data).toMatchObject({ phase: 'start', tool: 'read_file' });
    expect(toolEvents[1].data).toMatchObject({ phase: 'end', tool: 'read_file', ok: true });

    // And the hook still logged it (Kafka/audit path).
    expect(entries.map((e) => e.tool)).toEqual(['read_file']);
  });
});
