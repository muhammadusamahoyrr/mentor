// Session memory (the "recall facts from earlier in the session" deliverable).
//
// Key-value store keyed by an agent session id. Backed by Redis so a session
// survives restarts and is shared across replicas; falls back to an in-process
// Map (with TTL) when Redis is unavailable, so a demo never breaks. This mirrors
// the resilience of the platform's shared redisClient.
//
// Stored shape: { history: [{role, content}], facts: [string], updatedAt }
//   - history: compact prior Q/A (no tool churn) re-injected as in-context memory
//   - facts:   short distilled notes the caller wants remembered
const redis = require('redis');

const TTL = Number(process.env.AGENT_SESSION_TTL || 1800); // 30 min
const key = (id) => `agent:session:${id}`;

// --- in-process fallback ---
const mem = new Map(); // id -> { value, expiresAt }
function memGet(id) {
  const e = mem.get(key(id));
  if (!e) return null;
  if (e.expiresAt <= Date.now()) {
    mem.delete(key(id));
    return null;
  }
  return e.value;
}
function memSet(id, value) {
  mem.set(key(id), { value, expiresAt: Date.now() + TTL * 1000 });
}

// --- redis (best-effort) ---
let client = null;
let ready = false;
let tried = false;

async function ensure() {
  if (ready && client?.isOpen) return true;
  if (tried && !ready) return false; // failed once — don't hammer the demo
  tried = true;
  try {
    client = redis.createClient({
      socket: {
        host: process.env.REDIS_HOST || 'localhost',
        port: Number(process.env.REDIS_PORT || 6379),
        connectTimeout: 1000,
        reconnectStrategy: false, // one shot; fall back to memory on failure
      },
      password: process.env.REDIS_PASSWORD || undefined,
      // RESP2: the v4+ client's RESP3 handshake uses HELLO, which only exists
      // from Redis 6.0. Against an older server the connect fails and sessions
      // silently degrade to per-process memory. See shared/trace/traceStore.js.
      RESP: 2,
    });
    client.on('error', () => {}); // errors are handled by the connect() reject
    await client.connect();
    ready = true;
    return true;
  } catch {
    ready = false;
    return false;
  }
}

const EMPTY = () => ({ history: [], facts: [] });

async function recall(sessionId) {
  if (await ensure()) {
    const raw = await client.get(key(sessionId));
    return raw ? JSON.parse(raw) : EMPTY();
  }
  return memGet(sessionId) || EMPTY();
}

async function save(sessionId, session) {
  const value = { ...session, updatedAt: new Date().toISOString() };
  const raw = JSON.stringify(value);
  if (await ensure()) {
    await client.set(key(sessionId), raw, { EX: TTL });
  } else {
    memSet(sessionId, value);
  }
  return value;
}

// Append a Q/A turn to a session's history and persist it. `meta.ownerId` is
// recorded once, on the first turn, so session reads can be scoped to the owner.
async function appendTurn(sessionId, question, answer, meta = {}) {
  const session = await recall(sessionId);
  if (meta.ownerId && !session.ownerId) session.ownerId = meta.ownerId;
  session.history = [
    ...(session.history || []),
    { role: 'user', content: question },
    { role: 'assistant', content: answer },
  ].slice(-20); // cap so context stays small
  return save(sessionId, session);
}

// True only when a real Redis is backing the store (for honesty in responses).
const isBackedByRedis = () => ready && !!client?.isOpen;

module.exports = { recall, save, appendTurn, isBackedByRedis, TTL };
