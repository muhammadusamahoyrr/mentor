const { verifyToken } = require('../utils/jwt');
const redisCache = require('../../../../shared/events/redisClient');

function getUserId(decoded) {
  return (decoded.id || decoded.userId)?.toString?.() ?? decoded.id;
}

exports.authenticate = async (req, res, next) => {
  try {
    const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Authentication required' });

    const decoded = verifyToken(token);
    const userId = getUserId(decoded);

    const session = await redisCache.getSession(userId);
    if (!session) {
      return res.status(401).json({ message: 'Session expired or logged out' });
    }

    req.user = {
      id: userId,
      email: session.email,
      role: session.role,
      name: session.name,
      specialization: session.specialization,
    };
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

exports.optionalAuthenticate = async (req, res, next) => {
  try {
    const token = req.cookies?.token;
    if (!token) return next();

    const decoded = verifyToken(token);
    const userId = getUserId(decoded);
    const session = await redisCache.getSession(userId);
    if (session) {
      req.user = { id: userId, ...session };
    }
  } catch {
    // Ignore invalid tokens on optional auth
  }
  next();
};

exports.authorizeRole = (...roles) => (req, res, next) => {
  const allowedRoles = roles.flat();
  if (!req.user || !allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ message: 'Access denied' });
  }
  next();
};
