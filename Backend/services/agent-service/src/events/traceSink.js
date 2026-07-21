// The second destination for hook events: the per-run trace that backs the
// "show me what this run did" view.
//
// The Kafka sink (./auditSink.js) is the DURABLE audit trail, but it is async and
// not ordered across partitions, so a live view built on it shows late and
// out-of-order steps. This sink writes synchronously to the shared trace store
// keyed by runId instead. Same events, two destinations, different jobs.
const trace = require('../../../../shared/trace/traceStore');

const SERVICE = 'agent-service';

/**
 * Returns an onEvent callback for createToolLogger. Fire-and-forget: a tracing
 * failure must never break, slow or reject into the agent's request path.
 */
function traceSink(runId) {
  if (!runId) return () => {};
  return (entry) => {
    trace
      .append(runId, {
        service: SERVICE,
        type: 'tool',
        // 'call' — the PLANNER's view: the agent asked for this tool and it came
        // back in `ms`. Distinct from the MCP server's 'start'/'end' pair, which
        // is the EXECUTION. Two services legitimately report the same tool call
        // from either side of the boundary; labelling them differently is what
        // keeps the merged trace readable instead of looking like duplicates.
        phase: 'call',
        tool: entry.tool,
        args: entry.args,
        ok: entry.ok,
        ms: entry.ms,
      })
      .catch(() => {
        /* never surface a tracing failure into the answer */
      });
  };
}

/** Record a non-tool step (run start/end, model turns, the final assessment). */
async function note(runId, step) {
  if (!runId) return;
  try {
    await trace.append(runId, { service: SERVICE, ...step });
  } catch {
    /* tracing is best-effort */
  }
}

/** Compose several onEvent sinks into one. */
const fanout =
  (...sinks) =>
  (entry) => {
    for (const sink of sinks) {
      try {
        sink(entry);
      } catch {
        /* one bad sink must not stop the others */
      }
    }
  };

module.exports = { traceSink, note, fanout, SERVICE };
