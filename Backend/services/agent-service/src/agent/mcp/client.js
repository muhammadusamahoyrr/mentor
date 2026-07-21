// agent-service as an MCP CLIENT.
//
// The skills the agent calls no longer live in this process — they live in
// healthcare-mcp, and we reach them over MCP's Streamable HTTP transport. What
// makes that safe is where the credentials ride:
//
//   x-internal-token  — proves agent-service is allowed to talk to the MCP server
//   Authorization     — the CALLER's doctor JWT, forwarded verbatim so the skills
//                       act as that doctor and no further
//   x-run-id          — ties the tool steps executed over there back to this run,
//                       so the trace stitches across the process boundary
//
// All three are TRANSPORT headers. None is ever a tool argument: tool arguments
// are chosen by the model and written into its context and the trace log.
//
// A connection is opened per run because the auth headers are per caller — a
// shared long-lived client would mean one doctor's connection serving another's
// request. The tool LIST is user-independent, so it is cached across runs to save
// a round-trip.
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const {
  StreamableHTTPClientTransport,
} = require('@modelcontextprotocol/sdk/client/streamableHttp.js');

const CLIENT_INFO = { name: 'agent-service', version: '1.0.0' };

let cachedDefinitions = null; // Anthropic-shaped tool defs, shared by all callers

/** True when the agent is configured to run its tools over MCP. */
const isConfigured = () => !!process.env.HEALTHCARE_MCP_URL;

// MCP advertises tools as {name, description, inputSchema}; the ReAct loop and
// both model providers speak the Anthropic shape {name, description, input_schema}.
const toAnthropicDefinition = (tool) => ({
  name: tool.name,
  description: tool.description,
  input_schema: tool.inputSchema,
});

// An MCP tool result is content blocks; our loop wants the plain object the skill
// returned. `structuredContent` carries it directly when the server sends it,
// otherwise we parse the JSON text block the server wrote.
function unwrapResult(result) {
  if (result?.structuredContent) return result.structuredContent;

  const text = (result?.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n');

  try {
    return JSON.parse(text);
  } catch {
    return { text };
  }
}

async function connect(ctx = {}) {
  const url = process.env.HEALTHCARE_MCP_URL;
  const internalToken = process.env.INTERNAL_SERVICE_TOKEN;
  if (!internalToken) {
    throw new Error(
      'INTERNAL_SERVICE_TOKEN is not set — agent-service cannot authenticate to healthcare-mcp'
    );
  }

  const headers = {
    'x-internal-token': internalToken,
    ...(ctx.token ? { Authorization: `Bearer ${ctx.token}` } : {}),
    ...(ctx.runId ? { 'x-run-id': ctx.runId } : {}),
  };

  const client = new Client(CLIENT_INFO);
  await client.connect(new StreamableHTTPClientTransport(new URL(url), { requestInit: { headers } }));
  return client;
}

/**
 * Open an MCP-backed tool gateway for one run.
 *
 * @param {object} ctx  { token, userId, runId }
 * @returns {Promise<{kind, definitions, call, close}>}
 */
async function open(ctx = {}) {
  const client = await connect(ctx);

  if (!cachedDefinitions) {
    const { tools } = await client.listTools();
    cachedDefinitions = tools.map(toAnthropicDefinition);
  }

  return {
    kind: 'mcp',
    definitions: cachedDefinitions,
    // The caller's identity is already baked into the connection's headers, so
    // the per-call ctx is deliberately ignored here — the server derives it from
    // the verified JWT rather than trusting anything the model produced.
    //
    // The runId, by contrast, is sent per CALL in `_meta`. It could ride the
    // connection header alone (we send it there too), but that is
    // connection-scoped: the moment connections are pooled or reused across runs,
    // a header would attribute steps to the wrong run. `_meta` travels with the
    // individual call and cannot drift.
    async call(name, input) {
      const result = await client.callTool({
        name,
        arguments: input || {},
        ...(ctx.runId ? { _meta: { runId: ctx.runId } } : {}),
      });
      if (result?.isError) {
        const payload = unwrapResult(result);
        throw new Error(payload?.error || payload?.text || `Tool ${name} failed`);
      }
      return unwrapResult(result);
    },
    async close() {
      try {
        await client.close();
      } catch {
        /* closing a finished run must never fail the request */
      }
    },
  };
}

// Tests re-point the server between cases; drop the memoized tool list.
function _resetCache() {
  cachedDefinitions = null;
}

module.exports = { open, isConfigured, unwrapResult, toAnthropicDefinition, _resetCache };
