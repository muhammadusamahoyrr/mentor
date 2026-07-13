const { verifyToken } = require('../utils/jwt');

// Reads the JWT minted by auth-service. The Next.js BFF forwards it both as a
// cookie and as a bearer token, so accept either.
exports.authenticate = (req, res, next) => {
  // An explicit Authorization header states intent; a cookie is sent ambiently by
  // the browser. When both are present the header must win, otherwise a stale
  // cookie silently overrides the token the caller actually chose to send.
  const token =
    req.headers.authorization?.split(' ')[1] || req.cookies?.token;

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

/**
 * Role-based access control.
 *
 * Authentication answers "who are you"; this answers "what may your role do at
 * all", independent of which record is being touched. The ownership and
 * appointment-participant checks in the controller are a separate, narrower
 * question and both still apply on top of this.
 *
 *   authorizeRole('doctor')            -> doctors only
 *   authorizeRole('doctor', 'patient') -> either
 */
exports.authorizeRole = (...roles) => {
  const allowed = roles.flat();

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!allowed.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied: this action requires the role ${allowed.join(' or ')}`,
      });
    }
    next();
  };
};
