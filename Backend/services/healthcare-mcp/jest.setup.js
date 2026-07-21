// Jest does not read .env. Supply test-only values so the modules that fail
// loudly on a missing secret (auth.js) can load at all.
process.env.INTERNAL_SERVICE_TOKEN =
  process.env.INTERNAL_SERVICE_TOKEN || 'test-internal-token-value';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

// Force the trace store onto its in-process fallback: no dependency on a running
// Redis in CI, and no lingering socket handle after the suite finishes.
process.env.REDIS_PORT = '65530';

// Leave the skill API keys unset on purpose — the tests assert the no-key guards
// fire rather than reaching the live Brave/Voyage APIs. Tests must never call the
// network.
delete process.env.BRAVE_API_KEY;
delete process.env.VOYAGE_API_KEY;
