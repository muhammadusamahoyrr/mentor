// The Hook: a pre/post interceptor wrapped around every tool (skill) call. It
// records the tool name, (redacted) arguments, a start timestamp, duration and
// success — the assignment's "log every tool call with timestamps".
//
// Phase 1: logs to the console and an in-memory array (visible in the CLI).
// Phase 2: the same entries are also published to Kafka topic `agent.tool.called`,
// which audit-service already persists — turning the log into a durable,
// queryable audit trail.

// Keep tool arguments loggable without dumping large blobs (e.g. a whole file).
function redact(input) {
  const out = {};
  for (const [k, v] of Object.entries(input || {})) {
    out[k] = typeof v === 'string' && v.length > 200 ? `${v.slice(0, 200)}…` : v;
  }
  return out;
}

/**
 * @param {object}   opts
 * @param {string}   opts.sessionId
 * @param {function} [opts.onEvent]  called with each finished log entry (Phase 2: Kafka publish)
 * @returns {{ hook: function, entries: object[] }}
 *   hook(name, input, run) awaits run(), logs, and returns run()'s result.
 */
function createToolLogger({ sessionId = 'anon', onEvent } = {}) {
  const entries = [];

  async function hook(name, input, run) {
    const ts = new Date().toISOString();
    const t0 = Date.now();
    let ok = true;
    try {
      return await run();
    } catch (err) {
      ok = false;
      throw err;
    } finally {
      const entry = {
        sessionId,
        tool: name,
        args: redact(input),
        ok,
        ms: Date.now() - t0,
        ts,
      };
      entries.push(entry);
      console.log(`[tool] ${name} ${entry.ms}ms ${ok ? 'ok' : 'ERR'} @ ${ts}`);
      if (onEvent) {
        try {
          onEvent(entry);
        } catch {
          /* a logging sink must never break the agent */
        }
      }
    }
  }

  return { hook, entries };
}

module.exports = { createToolLogger, redact };
