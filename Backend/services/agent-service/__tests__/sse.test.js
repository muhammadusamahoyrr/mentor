// End-to-end SSE test over real HTTP (supertest), Claude client mocked. Proves
// the content-negotiated streaming path emits well-formed SSE frames.
jest.mock('@anthropic-ai/sdk', () => {
  return class FakeAnthropic {
    constructor() {
      this.messages = {
        // JSON path (unused here, kept for parity)
        create: async () => ({
          stop_reason: 'end_turn',
          content: [{ type: 'text', text: 'stub answer' }],
        }),
        // Streaming path
        stream: () => {
          const handlers = {};
          const s = {
            on: (event, cb) => {
              handlers[event] = cb;
              return s;
            },
            finalMessage: async () => {
              if (handlers.text) {
                handlers.text('stub ');
                handlers.text('answer');
              }
              return { stop_reason: 'end_turn', content: [{ type: 'text', text: 'stub answer' }] };
            },
          };
          return s;
        },
      };
    }
  };
});

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/server');

const sign = (payload) => jwt.sign(payload, process.env.JWT_SECRET);

describe('POST /api/agent/ask (SSE)', () => {
  it('streams session, token and done events when Accept is text/event-stream', async () => {
    const t = sign({ id: 'd1', role: 'doctor' });
    const r = await request(app)
      .post('/api/agent/ask')
      .set('Authorization', `Bearer ${t}`)
      .set('Accept', 'text/event-stream')
      .send({ question: 'hi' })
      .expect(200);

    expect(r.headers['content-type']).toMatch(/text\/event-stream/);
    expect(r.text).toContain('event: session');
    expect(r.text).toContain('event: token');
    expect(r.text).toContain('event: done');
    expect(r.text).toContain('stub answer');
  });

  it('still returns JSON when Accept is not event-stream', async () => {
    const t = sign({ id: 'd1', role: 'doctor' });
    const r = await request(app)
      .post('/api/agent/ask')
      .set('Authorization', `Bearer ${t}`)
      .send({ question: 'hi' })
      .expect(200);
    expect(r.headers['content-type']).toMatch(/application\/json/);
    expect(r.body.answer).toBe('stub answer');
  });
});
