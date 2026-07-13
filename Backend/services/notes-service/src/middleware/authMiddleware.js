const { verifyToken } = require('../utils/jwt');

// Reads the JWT minted by auth-service. The Next.js BFF forwards it both as a
// cookie and as a bearer token, so accept either.
exports.authenticate = (req, res, next) => {
  const token =
    req.cookies?.token || req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const decoded = verifyToken(token);
    req.user = {
      ...decoded,
      id: String(decoded.id ?? decoded.userId ?? ''),
    };
    req.token = token;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};
