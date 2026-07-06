const { verifyToken } = require('../utils/jwt');

exports.authenticate = (req, res, next) => {
  try {
    const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Authentication required' });

    const decoded = verifyToken(token);
    req.user = {
      ...decoded,
      id: (decoded.id || decoded.userId)?.toString?.() ?? decoded.id,
    };
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

exports.authorizeRole = (...roles) => (req, res, next) => {
  const allowedRoles = roles.flat();
  if (!req.user || !allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ message: 'Access denied' });
  }
  next();
};
