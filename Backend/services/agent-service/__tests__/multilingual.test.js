const { buildSystemPrompt } = require('../src/agent/systemPrompt');
const { runAgent } = require('../src/agent/loop');

// A fake client that captures the `system` prompt sent to the model.
function capturingClient(answer = 'respuesta') {
  const calls = [];
  return {
    calls,
    messages: {
      create: async (params) => {
        calls.push(params);
        return { stop_reason: 'end_turn', content: [{ type: 'text', text: answer }] };
      },
    },
  };
}

describe('multilingual: safety rules survive translation', () => {
  it.each(['Spanish', 'Urdu'])(
    'buildSystemPrompt(%s) keeps the never-diagnose / cite / refuse rules and sets the language',
    (language) => {
      const prompt = buildSystemPrompt({ language });
      expect(prompt).toMatch(/DO NOT DIAGNOSE OR PRESCRIBE/i);
      expect(prompt).toMatch(/ground|cite/i);
      expect(prompt).toMatch(new RegExp(language, 'i'));
      // and the rules are explicitly re-asserted for the target language
      expect(prompt).toMatch(new RegExp(`apply.*${language}|${language}.*never diagnose`, 'i'));
    }
  );

  it('the loop actually sends the safety rules to the model when answering in Urdu', async () => {
    const client = capturingClient();
    await runAgent({ question: 'salaam', language: 'Urdu', client });
    const sentSystem = client.calls[0].system;
    // The safety contract must be present in the prompt even for a non-English answer.
    expect(sentSystem).toMatch(/DO NOT DIAGNOSE OR PRESCRIBE/i);
    expect(sentSystem).toMatch(/refuse unsafe requests/i);
    expect(sentSystem).toMatch(/Urdu/);
  });
});
