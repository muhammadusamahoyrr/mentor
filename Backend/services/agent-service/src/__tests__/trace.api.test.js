// End-to-end over the real endpoints, with the model mocked: the validated
// trailer (including its one repair retry) and the per-run trace surface.

// A scripted model. Each entry is the text of one `messages.create` reply, so a
// test can make the FIRST answer bad and the REPAIR reply good.
// (Jest only lets a mock factory close over names prefixed `mock`.)
let mockScript = [];
let mockCalls = 0;

jest.mock('@anthropic-ai/sdk', () => {
  return class FakeAnthropic {
    constructor() {
      this.messages = {
        create: async () => {
          const text = mockScript[Math.min(mockCalls, mockScript.length - 1)];
          mockCalls += 1;
          return { stop_reason: 'end_turn', content: [{ type: 'text', text }] };
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
const doctor = (id = 'd1') => `Bearer ${sign({ id, role: 'doctor' })}`;

const GOOD_TRAILER =
  'Beta blockers reduce mortality in heart failure.\n' +
  'AGENT_META: {"sources":[{"title":"ESC 2021","ref":"https://example.org/esc"}],"confidence":"high"}';

beforeEach(() => {
  mockScript = [GOOD_TRAILER];
  mockCalls = 0;
  trace._resetMemory();
});

describe('the validated answer trailer', () => {
  it('returns the parsed sources and confidence, with the trailer stripped', async () => {
    const r = await request(app)
      .post('/api/agent/ask')
      .set('Authorization', doctor())
      .send({ question: 'beta blockers?' })
      .expect(200);

    expect(r.body.answer).toBe('Beta blockers reduce mortality in heart failure.');
    expect(r.body.answer).not.toMatch(/AGENT_META/);
    expect(r.body.confidence).toBe('high');
    expect(r.body.sources).toEqual([{ title: 'ESC 2021', ref: 'https://example.org/esc' }]);
    expect(mockCalls).toBe(1); // a valid trailer needs no repair
  });

  it('repairs a missing trailer with exactly one extra model call', async () => {
    mockScript = [
      'Beta blockers reduce mortality in heart failure.', // no trailer
      'AGENT_META: {"sources":[{"title":"ESC 2021","ref":"https://example.org/esc"}],"confidence":"medium"}',
    ];

    const r = await request(app)
      .post('/api/agent/ask')
      .set('Authorization', doctor())
      .send({ question: 'beta blockers?' })
      .expect(200);

    expect(mockCalls).toBe(2); // the run, then one repair
    expect(r.body.confidence).toBe('medium');
    expect(r.body.sources).toHaveLength(1);
    expect(r.body.answer).toBe('Beta blockers reduce mortality in heart failure.');
  });

  it('repairs an INVALID trailer, not just a missing one', async () => {
    mockScript = [
      'Text.\nAGENT_META: {"sources":[],"confidence":"very-high"}', // bad enum
      'AGENT_META: {"sources":[],"confidence":"low"}',
    ];

    const r = await request(app)
      .post('/api/agent/ask')
      .set('Authorization', doctor())
      .send({ question: 'x' })
      .expect(200);

    expect(mockCalls).toBe(2);
    expect(r.body.confidence).toBe('low');
    expect(r.body.answer).not.toMatch(/AGENT_META/);
  });

  it('skips the repair call entirely when AGENT_TRAILER_REPAIR=0', async () => {
    // The escape hatch for a rate-limited free tier: one fewer model call per
    // malformed answer, at the cost of the citations.
    process.env.AGENT_TRAILER_REPAIR = '0';
    mockScript = ['Some answer with no trailer at all.'];

    try {
      const r = await request(app)
        .post('/api/agent/ask')
        .set('Authorization', doctor())
        .send({ question: 'x' })
        .expect(200);

      expect(mockCalls).toBe(1); // no repair attempted
      expect(r.body.sources).toEqual([]);
      expect(r.body.answer).toBe('Some answer with no trailer at all.');
    } finally {
      delete process.env.AGENT_TRAILER_REPAIR;
    }
  });

  it('falls back to the legacy CONFIDENCE line when the repair also fails', async () => {
    // Both the run and the repair come back with the old marker and no trailer.
    mockScript = ['I could not find anything.\nCONFIDENCE: low'];

    const r = await request(app)
      .post('/api/agent/ask')
      .set('Authorization', doctor())
      .send({ question: 'obscure' })
      .expect(200);

    expect(r.body.confidence).toBe('low');
    expect(r.body.sources).toEqual([]);
    expect(r.body.answer).toMatch(/^Uncertain — please verify with the doctor/);
    expect(r.body.answer).not.toMatch(/CONFIDENCE:/);
  });
});

describe('GET /api/agent/traces/:runId', () => {
  it('returns the recorded step tree for the run that produced an answer', async () => {
    const ask = await request(app)
      .post('/api/agent/ask')
      .set('Authorization', doctor())
      .send({ question: 'beta blockers?' })
      .expect(200);

    expect(ask.body.runId).toEqual(expect.any(String));

    const r = await request(app)
      .get(`/api/agent/traces/${ask.body.runId}`)
      .set('Authorization', doctor())
      .expect(200);

    expect(r.body.runId).toBe(ask.body.runId);
    expect(r.body.services).toContain('agent-service');

    const start = r.body.steps.find((s) => s.type === 'run' && s.phase === 'start');
    const end = r.body.steps.find((s) => s.type === 'run' && s.phase === 'end');
    expect(start).toMatchObject({ question: 'beta blockers?', userId: 'd1' });
    expect(typeof start.ts).toBe('string');
    expect(end).toMatchObject({ confidence: 'high', stopReason: 'end_turn' });
  });

  it('will not show one doctor another doctor\'s run', async () => {
    const ask = await request(app)
      .post('/api/agent/ask')
      .set('Authorization', doctor('d1'))
      .send({ question: 'private question' })
      .expect(200);

    await request(app)
      .get(`/api/agent/traces/${ask.body.runId}`)
      .set('Authorization', doctor('d2'))
      .expect(403);
  });

  it('404s for a run that was never recorded', async () => {
    await request(app)
      .get('/api/agent/traces/no-such-run')
      .set('Authorization', doctor())
      .expect(404);
  });

  it('requires authentication', async () => {
    await request(app).get('/api/agent/traces/anything').expect(401);
  });
});
