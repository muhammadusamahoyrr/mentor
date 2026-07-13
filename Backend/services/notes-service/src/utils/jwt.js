const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is not set — notes-service cannot verify tokens');
}

exports.verifyToken = (token) => jwt.verify(token, JWT_SECRET);
