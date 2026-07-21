const path = require('path');

// Jest does not read .env. Supply test-only values so modules that fail loudly
// on a missing secret (utils/jwt) can load, and point read_file at fixtures.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.AGENT_DOCS_DIR = path.join(__dirname, 'src', '__tests__', 'fixtures');

// Pin the provider to Anthropic — the integration suites mock @anthropic-ai/sdk.
// Requiring server.js runs dotenv.config(), which loads a real GEMINI_API_KEY from
// .env; without this, resolveProvider() would auto-pick Gemini and the tests would
// hit the live API (non-deterministic + rate-limited). dotenv never overrides an
// already-set var, so this wins. Tests must never call the network.
process.env.AGENT_PROVIDER = 'anthropic';

// Neutralise the external API keys: the loop tests inject a fake client, and the
// web_search test asserts the no-key guard fires.
//
// ⚠️ EMPTY STRING, NOT `delete`. server.js calls dotenv.config() AFTER this file
// and fills in any key that is ABSENT — deleting hands the real key straight back
// and the suite starts calling the live API. An empty string is still "in"
// process.env, so dotenv leaves it, and every guard treats it as missing.
process.env.BRAVE_API_KEY = '';

// Run the tools IN-PROCESS by default. .env now carries a real
// HEALTHCARE_MCP_URL, and dotenv would hand it to the suite — every test would
// then try to reach an MCP server that is not running and fail with a 500. The
// one suite that genuinely wants MCP (mcpGateway.test.js) boots its own server
// and sets this itself. Empty string, not delete, so dotenv cannot refill it.
process.env.HEALTHCARE_MCP_URL = '';

// Force session memory onto its in-process fallback (no dependency on a running
// Redis in CI, and no lingering socket handle).
process.env.REDIS_HOST = '127.0.0.1';
process.env.REDIS_PORT = '65530';

// No Kafka broker in tests — make the audit sink a no-op so a low-confidence
// answer's hook publish doesn't spew connection errors after teardown.
process.env.AGENT_DISABLE_KAFKA = '1';

// The embed test asserts the no-key guard; retrieval tests mock embeddings.
// Empty string rather than delete, for the dotenv reason above.
process.env.VOYAGE_API_KEY = '';
