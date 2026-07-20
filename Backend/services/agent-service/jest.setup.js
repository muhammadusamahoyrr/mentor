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

// Leave ANTHROPIC_API_KEY / BRAVE_API_KEY unset on purpose: the loop tests inject
// a fake client, and the web_search test asserts the no-key guard fires.
delete process.env.BRAVE_API_KEY;

// Force session memory onto its in-process fallback (no dependency on a running
// Redis in CI, and no lingering socket handle).
process.env.REDIS_PORT = '65530';

// No Kafka broker in tests — make the audit sink a no-op so a low-confidence
// answer's hook publish doesn't spew connection errors after teardown.
process.env.AGENT_DISABLE_KAFKA = '1';

// The embed test asserts the no-key guard; retrieval tests mock embeddings.
delete process.env.VOYAGE_API_KEY;
