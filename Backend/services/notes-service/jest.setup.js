// Runs before any test file is imported, and therefore before src/db.js
// constructs the Prisma client and before src/server.js calls dotenv.config().
//
// dotenv does not overwrite variables that are already set, so assigning them
// here wins over .env. That keeps the suite off the real dev database and off
// the real signing key.
process.env.DATABASE_URL = 'file:./test.db';
process.env.JWT_SECRET = 'test-only-secret-not-used-anywhere-real';
process.env.APPOINTMENT_SERVICE_URL = 'http://127.0.0.1:4999';
process.env.NODE_ENV = 'test';
