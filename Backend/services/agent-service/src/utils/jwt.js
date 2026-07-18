const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

// Fail loudly at import, not silently at first request. Jest supplies a
// test-only secret in jest.setup.js (dotenv is not read under test).
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is not set — agent-service cannot verify tokens');
}

exports.verifyToken = (token) => jwt.verify(token, JWT_SECRET);
