const { verifyToken } = require('../utils/jwt');

exports.authenticate = (req, res, next) => {
  try {
    // An explicit Authorization header states intent; a cookie is sent ambiently
    // by the browser. When both are present the header must win, otherwise a
    // stale cookie silently overrides the token the caller chose to send.
    const token = req.headers.authorization?.split(' ')[1] || req.cookies?.token;
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
