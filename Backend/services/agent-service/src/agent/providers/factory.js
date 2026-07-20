// Provider selection. The agent runs its ReAct loop on either Claude (Anthropic)
// or Gemini (Google), chosen by env — so you can demo it for free with whichever
// API key you have.
//
//   AGENT_PROVIDER=anthropic|gemini   explicit choice; otherwise auto-detected
//                                     from which API key is present (Anthropic wins).
//   ANTHROPIC_API_KEY / AGENT_MODEL   Claude (default model claude-sonnet-5)
//   GEMINI_API_KEY / GEMINI_MODEL     Gemini (default model gemini-2.5-flash)

function resolveProvider() {
  const explicit = (process.env.AGENT_PROVIDER || '').toLowerCase();
  if (explicit === 'gemini' || explicit === 'anthropic') return explicit;

  if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
  if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) return 'gemini';
  return 'anthropic';
}

function defaultModel(provider = resolveProvider()) {
  if (provider === 'gemini') return process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  return process.env.AGENT_MODEL || 'claude-sonnet-5';
}

// Returns a client exposing `.messages.create` and `.messages.stream` — the
// interface the loop uses, regardless of provider.
function createClient(provider = resolveProvider()) {
  if (provider === 'gemini') {
    const { GeminiClient } = require('./gemini');
    return new GeminiClient({
      apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
    });
  }
  const Anthropic = require('@anthropic-ai/sdk');
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

module.exports = { resolveProvider, defaultModel, createClient };
