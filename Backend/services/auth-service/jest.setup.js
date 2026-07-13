// Runs before any test file is imported.
//
// The jwt/internal-auth modules deliberately throw at load time if their secrets
// are missing, so a service can never silently fall back to a publicly-known
// default key. Jest does not read .env, so the suite has to supply its own
// test-only values — otherwise every suite fails to import.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only-secret-not-used-anywhere-real';
process.env.INTERNAL_SERVICE_TOKEN =
  process.env.INTERNAL_SERVICE_TOKEN || 'test-only-internal-token';
process.env.NODE_ENV = 'test';
