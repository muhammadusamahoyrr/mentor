// Provider selection. The agent runs its ReAct loop on Claude (Anthropic),
// Gemini (Google) or OpenRouter, chosen by env — so you can demo it for free with
// whichever API key you have.
//
//   AGENT_PROVIDER=anthropic|gemini|openrouter   explicit primary; otherwise
//                                     auto-detected from which key is present.
//   AGENT_PROVIDERS=gemini,openrouter explicit ORDERED fallback chain (overrides
//                                     AGENT_PROVIDER).
//   ANTHROPIC_API_KEY  / AGENT_MODEL       Claude      (default claude-sonnet-5)
//   GEMINI_API_KEY     / GEMINI_MODEL      Gemini      (default gemini-2.5-flash)
//   OPENROUTER_API_KEY / OPENROUTER_MODEL  OpenRouter  (default a free model)
//
// FALLBACK: with more than one provider configured, a failed request rolls over
// to the next instead of failing the doctor's question — which is what keeps a
// rate-limited free tier usable. See ./fallback.js for when it does and does not.
const { createFallbackClient } = require('./fallback');

const KNOWN = ['anthropic', 'gemini', 'openrouter'];

// Order the remaining providers are appended in when building a chain automatically.
const AUTO_ORDER = ['anthropic', 'gemini', 'openrouter'];

const keyFor = (provider) => {
  if (provider === 'anthropic') return process.env.ANTHROPIC_API_KEY;
  if (provider === 'gemini') return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (provider === 'openrouter') return process.env.OPENROUTER_API_KEY;
  return undefined;
};

const hasKey = (provider) => !!keyFor(provider);

function resolveProvider() {
  const explicit = (process.env.AGENT_PROVIDER || '').toLowerCase();
  if (KNOWN.includes(explicit)) return explicit;

  if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
  if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) return 'gemini';
  if (process.env.OPENROUTER_API_KEY) return 'openrouter';
  return 'anthropic';
}

function defaultModel(provider = resolveProvider()) {
  if (provider === 'gemini') return process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  if (provider === 'openrouter') {
    // A free model by default, so adding only OPENROUTER_API_KEY is enough to get
    // a working fallback with no further configuration.
    return process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct:free';
  }
  return process.env.AGENT_MODEL || 'claude-sonnet-5';
}

/**
 * The ordered provider chain.
 *
 * An explicit AGENT_PROVIDERS list wins. Otherwise the primary goes first and
 * every OTHER provider that actually has a key is appended — so adding a second
 * key is all it takes to get fallback, with no further configuration.
 *
 * The primary is always included even without a key: an explicit AGENT_PROVIDER
 * must be honoured, and the tests inject a fake client rather than set a real key.
 */
function resolveProviderChain() {
  const listed = (process.env.AGENT_PROVIDERS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => KNOWN.includes(s));

  if (listed.length) return [...new Set(listed)];

  const primary = resolveProvider();
  const chain = [primary];
  for (const p of AUTO_ORDER) {
    if (p !== primary && hasKey(p)) chain.push(p);
  }
  return chain;
}

// One provider's client, exposing `.messages.create` / `.messages.stream`.
function createProviderClient(provider = resolveProvider()) {
  if (provider === 'gemini') {
    const { GeminiClient } = require('./gemini');
    return new GeminiClient({
      apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
    });
  }
  if (provider === 'openrouter') {
    const { OpenRouterClient } = require('./openrouter');
    return new OpenRouterClient({ apiKey: process.env.OPENROUTER_API_KEY });
  }
  const Anthropic = require('@anthropic-ai/sdk');
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

/**
 * Returns a client exposing `.messages.create` and `.messages.stream` — the
 * interface the loop uses, regardless of provider.
 *
 * With one provider configured this IS that provider's client, unchanged. With
 * several it is a fallback chain over them, presenting the same interface.
 */
function createClient(provider) {
  if (provider) return createProviderClient(provider); // explicit: no chain

  const chain = resolveProviderChain();
  if (chain.length === 1) return createProviderClient(chain[0]);

  return createFallbackClient(
    chain.map((p) => ({
      provider: p,
      model: defaultModel(p),
      client: createProviderClient(p),
    }))
  );
}

module.exports = {
  resolveProvider,
  resolveProviderChain,
  defaultModel,
  createClient,
  createProviderClient,
  hasKey,
  KNOWN,
};
