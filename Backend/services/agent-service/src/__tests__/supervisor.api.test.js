// Orchestration through the REAL endpoint with AGENT_MODE=supervisor: proves the
// controller wiring, that the trace spans the agent graph (assignment item 4),
// and that turning it on changes nothing downstream — trailer, confidence,
// memory and sources all still work.
let mockReply = () => '';

jest.mock('@anthropic-ai/sdk', () => {
  const message = (text) => ({ stop_reason: 'end_turn', content: [{ type: 'text', text }] });
  return class FakeAnthropic {
    constructor() {
      this.messages = {
        create: async (params) => message(mockReply(params)),
        stream: (params) => {
          const text = mockReply(params);
          return {
            on(e, cb) {
              if (e === 'text') cb(text);
              return this;
            },
            finalMessage: async () => message(text),
          };
        },
      };
    }
  };
});

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../server');
const trace = require('../../../../shared/trace/traceStore');

const sign = (payload) => jwt.sign(payload, process.env.JWT_SECRET);
const doctor = () => `Bearer ${sign({ id: 'd1', role: 'doctor' })}`;

const promptOf = (params) =>
  (params.messages || []).map((m) => (typeof m.content === 'string' ? m.content : '')).join('\n');

beforeEach(() => {
  process.env.AGENT_MODE = 'supervisor';
  trace._resetMemory();
  mockReply = (params) => {
    const text = promptOf(params);
    if (text.includes('routing a doctor')) {
      return '{"assignments":[{"worker":"research","subtask":"hypertension guidelines"}]}';
    }
    if (text.includes('Specialist agents investigated')) {
      return 'Lifestyle change first.\nAGENT_META: {"sources":[{"title":"NICE NG136","ref":"http://x"}],"confidence":"high"}';
    }
    return 'NICE says lifestyle change. Source: http://x';
  };
});

afterEach(() => {
  delete process.env.AGENT_MODE;
});

describe('POST /api/agent/ask with orchestration on', () => {
  it('returns one composed answer plus per-worker timings', async () => {
    const r = await request(app)
      .post('/api/agent/ask')
      .set('Authorization', doctor())
      .send({ question: 'stage 1 hypertension?' })
      .expect(200);

    expect(r.body.answer).toBe('Lifestyle change first.');
    expect(r.body.confidence).toBe('high');
    expect(r.body.sources).toEqual([{ title: 'NICE NG136', ref: 'http://x' }]);

    // §4.6 — the cost/latency story is reported, not guessed at.
    expect(r.body.orchestration.mode).toMatch(/parallel|sequential/);
    expect(r.body.orchestration.workers).toEqual([
      {
        worker: 'research',
        ok: true,
        ms: expect.any(Number),
        error: null,
        usage: expect.objectContaining({ calls: expect.any(Number) }),
      },
    ]);
    // §4.6 — tokens and call count for the whole run, flagged honestly when the
    // provider withheld usage (`complete: false` means the total is a floor).
    expect(r.body.orchestration.usage).toMatchObject({
      calls: expect.any(Number),
      totalTokens: expect.any(Number),
      complete: expect.any(Boolean),
    });
  });

  it('records a trace that spans the agent graph, labelled per agent', async () => {
    const ask = await request(app)
      .post('/api/agent/ask')
      .set('Authorization', doctor())
      .send({ question: 'stage 1 hypertension?' })
      .expect(200);

    const r = await request(app)
      .get(`/api/agent/traces/${ask.body.runId}`)
      .set('Authorization', doctor())
      .expect(200);

    const agents = r.body.steps.filter((s) => s.agent).map((s) => s.agent);
    expect(agents).toEqual(expect.arrayContaining(['supervisor', 'research']));

    // The routing decision itself is recorded — that is what makes a bad answer
    // debuggable: you can see which agent was asked what.
    const routed = r.body.steps.find((s) => s.phase === 'routed');
    expect(routed.assignments[0]).toMatchObject({ worker: 'research' });

    const end = r.body.steps.find((s) => s.type === 'run' && s.phase === 'end');
    expect(end.orchestration.workers[0].worker).toBe('research');
  });

  it('leaves single-agent mode untouched when AGENT_MODE is not set', async () => {
    delete process.env.AGENT_MODE;
    mockReply = () =>
      'Direct answer.\nAGENT_META: {"sources":[],"confidence":"medium"}';

    const r = await request(app)
      .post('/api/agent/ask')
      .set('Authorization', doctor())
      .send({ question: 'anything' })
      .expect(200);

    expect(r.body.answer).toBe('Direct answer.');
    expect(r.body.orchestration).toBeNull(); // no orchestration happened
  });

  it('streams only the supervisor composition over SSE', async () => {
    const res = await request(app)
      .post('/api/agent/ask')
      .set('Authorization', doctor())
      .set('Accept', 'text/event-stream')
      .send({ question: 'stage 1 hypertension?' })
      .expect(200);

    const tokens = res.text
      .split('\n\n')
      .filter((f) => f.startsWith('event: token'))
      .map((f) => JSON.parse(f.split('data: ')[1]).text)
      .join('');

    expect(tokens).toContain('Lifestyle change first.');
    // The worker's own prose must never reach the panel (§4.2).
    expect(tokens).not.toContain('NICE says lifestyle change');
    // ...but its activity does, as step events.
    expect(res.text).toContain('event: step');
    expect(res.text).toMatch(/"agent":"research"/);
  });
});
