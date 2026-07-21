// Two-layer auth for the MCP endpoint, both read off the TRANSPORT — never off a
// tool argument. Tool arguments are chosen by the model, echoed into its context
// and written to the trace log; a credential in one is a credential leaked.
//
//   1. x-internal-token  — service-to-service trust. This endpoint runs every
//      clinical skill, so only our own services may reach it at all. Same
//      constant-time check as notification-service's internalAuth.
//   2. Authorization: Bearer <doctor JWT> — the CALLER's own token, forwarded by
//      agent-service. Every skill uses it downstream, so the MCP server inherits
//      exactly the doctor's access and never more.
//
// x-run-id ties the tool steps executed here back to the run that asked for them,
// so the trace stitches across the process boundary.
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN;
const JWT_SECRET = process.env.JWT_SECRET;

// Fail loudly at import rather than silently serving an open endpoint.
if (!INTERNAL_TOKEN) {
  throw new Error(
    'INTERNAL_SERVICE_TOKEN is not set — refusing to start with an open MCP endpoint'
  );
}
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is not set — healthcare-mcp cannot verify caller tokens');
}

// Constant-time compare so the token can't be guessed a byte at a time.
const matches = (candidate) => {
  if (typeof candidate !== 'string' || candidate.length !== INTERNAL_TOKEN.length) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(INTERNAL_TOKEN));
};

/**
 * Express middleware guarding POST /mcp. On success sets `req.mcpContext`:
 *   { token, userId, role, runId }
 * which becomes the `ctx` every skill handler receives.
 */
function mcpAuth(req, res, next) {
  if (!matches(req.headers['x-internal-token'])) {
    return res.status(401).json({ error: 'Internal service token required' });
  }

  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Caller JWT required (Authorization: Bearer)' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Invalid or expired caller token' });
  }

  req.mcpContext = {
    token, // forwarded verbatim to sibling services by the skills
    userId: String(decoded.id ?? decoded.userId ?? ''),
    role: decoded.role,
    runId: req.headers['x-run-id'] || null,
  };
  next();
}

module.exports = { mcpAuth };
