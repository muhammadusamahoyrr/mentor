// The endpoint, tested end-to-end over real HTTP (supertest) with the Claude
// client mocked — no network, no API key. Proves the auth chain, that the loop
// runs, and that session memory persists and is owner-scoped.
jest.mock(
  '@anthropic-ai/sdk',
  () =>
    class FakeAnthropic {
      constructor() {
        this.messages = {
          create: async () => ({
            stop_reason: 'end_turn',
            content: [{ type: 'text', text: 'stub answer' }],
          }),
        };
      }
    }
);

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/server');

const sign = (payload) => jwt.sign(payload, process.env.JWT_SECRET);

describe('POST /api/agent/ask', () => {
  it('401 without a token', async () => {
    await request(app).post('/api/agent/ask').send({ question: 'hi' }).expect(401);
  });

  it('403 for a patient (doctor-only)', async () => {
    const t = sign({ id: 'p1', role: 'patient' });
    await request(app)
      .post('/api/agent/ask')
      .set('Authorization', `Bearer ${t}`)
      .send({ question: 'hi' })
      .expect(403);
  });

  it('400 for an empty question', async () => {
    const t = sign({ id: 'd1', role: 'doctor' });
    await request(app)
      .post('/api/agent/ask')
      .set('Authorization', `Bearer ${t}`)
      .send({})
      .expect(400);
  });

  it('200 for a doctor: returns an answer + sessionId and persists memory', async () => {
    const t = sign({ id: 'd1', role: 'doctor' });
    const r = await request(app)
      .post('/api/agent/ask')
      .set('Authorization', `Bearer ${t}`)
      .send({ question: 'hello' })
      .expect(200);

    expect(r.body.answer).toBe('stub answer');
    expect(r.body.sessionId).toBeTruthy();

    const s = await request(app)
      .get(`/api/agent/sessions/${r.body.sessionId}`)
      .set('Authorization', `Bearer ${t}`)
      .expect(200);
    expect(s.body.history).toHaveLength(2);
    expect(s.body.history[0]).toEqual({ role: 'user', content: 'hello' });
  });

  it('403 when a different doctor tries to read the session', async () => {
    const t1 = sign({ id: 'd1', role: 'doctor' });
    const t2 = sign({ id: 'd2', role: 'doctor' });
    const r = await request(app)
      .post('/api/agent/ask')
      .set('Authorization', `Bearer ${t1}`)
      .send({ question: 'x' })
      .expect(200);

    await request(app)
      .get(`/api/agent/sessions/${r.body.sessionId}`)
      .set('Authorization', `Bearer ${t2}`)
      .expect(403);
  });
});
