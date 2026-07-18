// End-to-end: a low-confidence answer gets the CONFIDENCE marker stripped, the
// verify-with-doctor notice prepended, and confidence reported — via the real
// endpoint with a mocked model.
jest.mock(
  '@anthropic-ai/sdk',
  () =>
    class FakeAnthropic {
      constructor() {
        this.messages = {
          create: async () => ({
            stop_reason: 'end_turn',
            content: [{ type: 'text', text: 'The sources I checked do not cover this.\nCONFIDENCE: low' }],
          }),
        };
      }
    }
);

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/server');

const sign = (payload) => jwt.sign(payload, process.env.JWT_SECRET);
const doctor = () => `Bearer ${sign({ id: 'd1', role: 'doctor' })}`;

describe('confidence on POST /api/agent/ask', () => {
  it('reports low confidence, strips the marker, and prepends the verify notice', async () => {
    const r = await request(app)
      .post('/api/agent/ask')
      .set('Authorization', doctor())
      .send({ question: 'something obscure' })
      .expect(200);

    expect(r.body.confidence).toBe('low');
    expect(r.body.answer).toMatch(/^Uncertain — please verify with the doctor/);
    expect(r.body.answer).not.toMatch(/CONFIDENCE:/);
  });

  it('accepts a language parameter without error', async () => {
    const r = await request(app)
      .post('/api/agent/ask')
      .set('Authorization', doctor())
      .send({ question: 'hola', language: 'Spanish' })
      .expect(200);
    expect(r.body).toHaveProperty('confidence');
  });
});
