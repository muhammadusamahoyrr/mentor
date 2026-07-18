// Helpers shared by the platform skills that call sibling services.
//
// Every such skill forwards the CALLER's own JWT — never a service token — so a
// skill can never reach data the doctor could not reach directly. The sibling
// service performs its normal participant/ownership check on that token; the
// agent inherits exactly the caller's access, nothing more.

function requireToken(ctx) {
  if (!ctx || !ctx.token) {
    throw new Error('This skill needs an authenticated caller (no token in context)');
  }
  return ctx.token;
}

// Forward as both header and cookie: some services read one, some the other, and
// the header is the deliberate statement of intent that must win.
function authHeaders(token, extra = {}) {
  return { Authorization: `Bearer ${token}`, Cookie: `token=${token}`, ...extra };
}

module.exports = { requireToken, authHeaders };
