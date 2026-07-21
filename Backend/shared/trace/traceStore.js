// The run trace: an ordered list of steps per `runId`, written SYNCHRONOUSLY as a
// run happens, so "show me this run" is answerable immediately.
//
// Why not Kafka? The tool-call hook already publishes to Kafka for the durable
// audit trail, but Kafka is asynchronous and not ordered across partitions — a
// live "what did this run do" view built on it shows late, out-of-order steps.
// So: Kafka stays the durable audit log; this store backs the trace VIEW.
//
// Both processes write here — agent-service records the planner/LLM steps, and
// healthcare-mcp records the tool executions that now happen on the far side of
// the MCP boundary. Keyed by the same `runId` (propagated across MCP via the
// x-run-id header), the two halves stitch back into one tree.
//
// Backed by Redis so the two processes share it; falls back to an in-process Map
// when Redis is unavailable, exactly like the agent's session memory. NOTE: the
// fallback is per-process, so cross-process stitching genuinely requires Redis —
// without it you still get each side's own steps, just not merged.
const redis = require('redis');

const TTL = Number(process.env.TRACE_TTL || 3600); // 1h — a trace is a debugging artifact
const MAX_STEPS = Number(process.env.TRACE_MAX_STEPS || 200); // cap a runaway run
const key = (runId) => `agent:trace:${runId}`;

// --- in-process fallback ---
const mem = new Map(); // key -> { steps: [], expiresAt }
function memGet(runId) {
  const e = mem.get(key(runId));
  if (!e) return null;
  if (e.expiresAt <= Date.now()) {
    mem.delete(key(runId));
    return null;
  }
  return e.steps;
}
function memAppend(runId, step) {
  const existing = memGet(runId) || [];
  if (existing.length >= MAX_STEPS) return existing;
  existing.push(step);
  mem.set(key(runId), { steps: existing, expiresAt: Date.now() + TTL * 1000 });
  return existing;
}

// --- redis (best-effort, one-shot connect) ---
let client = null;
let ready = false;
let tried = false;

async function ensure() {
  if (ready && client?.isOpen) return true;
  if (tried && !ready) return false; // failed once — don't hammer the request path
  tried = true;
  try {
    client = redis.createClient({
      socket: {
        host: process.env.REDIS_HOST || 'localhost',
        port: Number(process.env.REDIS_PORT || 6379),
        connectTimeout: 1000,
        reconnectStrategy: false,
      },
      password: process.env.REDIS_PASSWORD || undefined,
      // Speak RESP2. The v4+ client negotiates RESP3 with a HELLO command that
      // only exists from Redis 6.0 — against an older server (the Windows 3.0.x
      // port is still common) the connection fails with "unknown command HELLO"
      // and we silently fall back to per-process memory, which quietly breaks
      // cross-process trace stitching. RESP2 is understood by every version and
      // we use no RESP3 feature.
      RESP: 2,
    });
    client.on('error', () => {}); // handled by connect() rejecting
    await client.connect();
    ready = true;
    return true;
  } catch {
    ready = false;
    return false;
  }
}

/**
 * Record one step of a run. Never throws: a tracing failure must not break the
 * agent, exactly like the audit hook.
 *
 * @param {string} runId
 * @param {object} step  { service, type, tool?, phase?, ok?, ms?, ...detail }
 */
async function append(runId, step) {
  if (!runId) return;
  const entry = { ts: new Date().toISOString(), ...step };
  try {
    if (await ensure()) {
      const k = key(runId);
      await client.rPush(k, JSON.stringify(entry));
      await client.expire(k, TTL);
      await client.lTrim(k, 0, MAX_STEPS - 1);
      return;
    }
  } catch {
    /* fall through to memory */
  }
  memAppend(runId, entry);
}

/** All recorded steps for a run, in the order they happened. */
async function get(runId) {
  if (!runId) return [];
  try {
    if (await ensure()) {
      const raw = await client.lRange(key(runId), 0, -1);
      return raw.map((r) => {
        try {
          return JSON.parse(r);
        } catch {
          return { malformed: r };
        }
      });
    }
  } catch {
    /* fall through to memory */
  }
  return memGet(runId) || [];
}

/** True only when a real Redis is backing the store (honesty in responses). */
const isBackedByRedis = () => ready && !!client?.isOpen;

// Test helper: drop the in-process state between cases.
function _resetMemory() {
  mem.clear();
}

module.exports = { append, get, isBackedByRedis, TTL, MAX_STEPS, _resetMemory };
