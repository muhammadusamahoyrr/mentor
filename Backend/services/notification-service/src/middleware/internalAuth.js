const crypto = require('crypto');

const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN;

if (!INTERNAL_TOKEN) {
  throw new Error(
    'INTERNAL_SERVICE_TOKEN is not set — refusing to start with an open event endpoint'
  );
}

// Constant-time compare so the token can't be guessed a byte at a time.
const matches = (candidate) => {
  if (typeof candidate !== 'string' || candidate.length !== INTERNAL_TOKEN.length) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(INTERNAL_TOKEN));
};

/**
 * Guards POST /api/notifications/events.
 *
 * This endpoint writes a notification for an arbitrary userId, so it must only
 * ever be reachable service-to-service. It was previously unauthenticated *and*
 * proxied to the browser, which let any client forge a notification for anyone.
 */
exports.internalOnly = (req, res, next) => {
  const token = req.headers['x-internal-token'];

  if (!matches(token)) {
    return res.status(401).json({ message: 'Internal service token required' });
  }
  next();
};
