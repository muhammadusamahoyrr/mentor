const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

// Fail loudly rather than silently signing with a publicly-known default key.
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is not set — refusing to start with an insecure default');
}

exports.generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: user.role,
      name: user.name
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
};

exports.verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    throw new Error('Invalid token', { cause: error });
  }
};
