const { verifyToken } = require('../utils/jwt'); // make sure you have a jwt.js util

// Authenticate user by verifying JWT token
exports.authenticate = (req, res, next) => {
  try {
    // An explicit Authorization header states intent; a cookie is sent ambiently
    // by the browser. When both are present the header must win, otherwise a stale
    // cookie silently overrides the token the caller actually chose to send.
    const token = req.headers.authorization?.split(' ')[1] || req.cookies?.token;
    if (!token) return res.status(401).json({ message: 'Authentication required' });

    const decoded = verifyToken(token); // will throw if invalid
    req.user = {
      ...decoded,
      id: String(decoded.id ?? decoded.userId ?? ''),
    };
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

exports.authorizeRole = (...roles) => (req, res, next) => {
  // FIX: Flatten the roles array to handle cases where it's passed as an array
  // Example: authorizeRole('doctor') => ['doctor']
  // Example: authorizeRole(['doctor', 'patient']) => ['doctor', 'patient']
  const allowedRoles = roles.flat(); 

  if (!req.user || !allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ message: 'Access denied' });
  }
  next();
};
