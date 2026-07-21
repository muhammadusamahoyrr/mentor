// Jest does not read .env. Supply test-only values so the modules that fail
// loudly on a missing secret (auth.js) can load at all.
process.env.INTERNAL_SERVICE_TOKEN =
  process.env.INTERNAL_SERVICE_TOKEN || 'test-internal-token-value';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

// Force the trace store onto its in-process fallback: no dependency on a running
// Redis in CI, and no lingering socket handle after the suite finishes.
process.env.REDIS_HOST = '127.0.0.1';
process.env.REDIS_PORT = '65530';

// Neutralise the skill API keys so the tests assert the no-key guards fire
// instead of reaching the live Brave/Voyage APIs.
//
// ⚠️ EMPTY STRING, NOT `delete`. src/server.js calls dotenv.config(), which runs
// AFTER this file and fills in any key that is ABSENT — so deleting these hands
// them straight back from .env and the suite starts calling the real APIs (it
// did: web_search began succeeding and the fail-closed tests broke). An empty
// string is still "in" process.env, so dotenv leaves it alone, and every guard
// in the code treats it as missing.
process.env.BRAVE_API_KEY = '';
process.env.VOYAGE_API_KEY = '';
