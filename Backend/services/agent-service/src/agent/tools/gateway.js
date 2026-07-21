// Where the agent's tools actually run.
//
// One interface — { definitions, call(name, input, ctx), close() } — with two
// backends, so the ReAct loop never has to know which one it is talking to:
//
//   MCP        (HEALTHCARE_MCP_URL set) — the Week-5 path. Tools execute in the
//              healthcare-mcp server, reached over Streamable HTTP with the
//              caller's JWT on the transport.
//   in-process (unset)                  — the local registry. Keeps the CLI
//              harness, the unit tests and an offline demo working with no MCP
//              server to run, and is the fallback if MCP is not configured.
//
// The in-process set is a SUPERSET: it also has the local-disk `read_file`, which
// is deliberately not exposed over the network. So the two backends are not quite
// interchangeable, and that difference is the point — see ./registry.js.
const registry = require('./registry');
const mcp = require('../mcp/client');

function inProcess() {
  return {
    kind: 'in-process',
    definitions: registry.definitions,
    call(name, input, ctx) {
      const handler = registry.handlers[name];
      if (!handler) return Promise.reject(new Error(`Unknown skill: ${name}`));
      return handler(input, ctx);
    },
    close() {},
  };
}

/**
 * Open the configured tool backend for one run. The caller must close it.
 *
 * If MCP is configured but unreachable, we fail rather than silently falling back
 * to in-process: a doctor's question quietly running against a different tool set
 * (and skipping the MCP audit trail) is worse than a visible error.
 *
 * @param {object} ctx  { token, userId, runId }
 */
async function open(ctx = {}) {
  if (mcp.isConfigured()) return mcp.open(ctx);
  return inProcess();
}

/**
 * A narrowed view of an already-open gateway, exposing only `names`.
 *
 * This is how a worker gets its small tool slice (week5.md §4.1): the supervisor
 * opens ONE gateway — one MCP connection — and hands each worker a slice of it.
 * Narrow scopes are the "tool design for agents" point in practice: a research
 * worker that cannot see patient files cannot accidentally read one.
 *
 * The slice deliberately does NOT close the underlying gateway: several workers
 * share it, and the supervisor that opened it owns its lifetime.
 */
function slice(skills, names = []) {
  const allowed = new Set(names);
  return {
    kind: `${skills.kind}+slice`,
    definitions: skills.definitions.filter((d) => allowed.has(d.name)),
    call(name, input, ctx) {
      if (!allowed.has(name)) {
        // Refuse rather than forward: a worker asking for a tool outside its
        // scope is a routing bug (or an injection), and it should be visible.
        return Promise.reject(new Error(`Skill "${name}" is not available to this agent`));
      }
      return skills.call(name, input, ctx);
    },
    close() {},
  };
}

module.exports = { open, inProcess, slice };
