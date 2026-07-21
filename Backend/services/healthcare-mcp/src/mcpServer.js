// Builds an McpServer bound to ONE caller's context.
//
// The server is constructed per request (stateless Streamable HTTP): the doctor's
// JWT and the runId arrive on that request's headers, and every tool handler
// closes over them. This is why the JWT never has to be a tool argument, and why
// two concurrent doctors can never see each other's context.
const { McpServer, ResourceTemplate } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { z } = require('zod');
const platform = require('../../../shared/agent/tools/registry');
const readPatientFile = require('../../../shared/agent/tools/readPatientFile');
const listPatientFiles = require('../../../shared/agent/tools/listPatientFiles');
const trace = require('../../../shared/trace/traceStore');
const { toZodShape } = require('./schema');

const NAME = 'healthcare-mcp';
const VERSION = '1.0.0';

// Keep tool arguments loggable without dumping a whole document into the trace.
function redact(input) {
  const out = {};
  for (const [k, v] of Object.entries(input || {})) {
    out[k] = typeof v === 'string' && v.length > 200 ? `${v.slice(0, 200)}…` : v;
  }
  return out;
}

const PREVIEW_CHARS = 300;

// A summary of what a tool RETURNED, for the trace view. The whole point of
// opening a trace is usually "what did that tool actually give back?", so the
// output cannot be omitted — but a document read can be 20k characters, and the
// trace is not the place to store a second copy of a patient record. So: keep the
// scalar/count fields whole, and truncate long text to a preview.
function summarize(result) {
  if (result === null || result === undefined) return null;
  if (typeof result !== 'object') return { value: String(result).slice(0, PREVIEW_CHARS) };

  const out = {};
  for (const [k, v] of Object.entries(result)) {
    if (typeof v === 'string') {
      out[k] = v.length > PREVIEW_CHARS ? `${v.slice(0, PREVIEW_CHARS)}… (${v.length} chars)` : v;
    } else if (Array.isArray(v)) {
      out[k] = `[${v.length} item(s)]`;
    } else if (v && typeof v === 'object') {
      out[k] = '{…}';
    } else {
      out[k] = v; // numbers, booleans, null — the useful signal (count, truncated, flags)
    }
  }
  return out;
}

// THE MCP SERVER'S OWN HOOK. Once tools run over here, agent-service can only see
// "called X via MCP" — the real execution detail lives on this side, so this is
// where it has to be recorded. Steps are written against the caller's runId so
// they merge with agent-service's planner steps into one tree.
async function runTraced({ name, input, ctx }) {
  const startedAt = Date.now();
  await trace.append(ctx.runId, {
    service: NAME,
    type: 'tool',
    phase: 'start',
    tool: name,
    args: redact(input),
  });

  try {
    const result = await platform.handlers[name](input, ctx);
    await trace.append(ctx.runId, {
      service: NAME,
      type: 'tool',
      phase: 'end',
      tool: name,
      ok: true,
      ms: Date.now() - startedAt,
      injectionFlagged: !!result?.injectionFlagged,
      output: summarize(result),
    });
    return result;
  } catch (err) {
    await trace.append(ctx.runId, {
      service: NAME,
      type: 'tool',
      phase: 'end',
      tool: name,
      ok: false,
      ms: Date.now() - startedAt,
      error: err.message,
    });
    throw err;
  }
}

// MCP returns tool output as content blocks. Our skills return plain objects, so
// they go back as JSON text plus `structuredContent` for clients that read it.
const asToolResult = (value) => ({
  content: [{ type: 'text', text: JSON.stringify(value) }],
  structuredContent: value && typeof value === 'object' && !Array.isArray(value) ? value : undefined,
});

const asToolError = (message) => ({
  content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
  isError: true,
});

function registerTools(server, ctx) {
  for (const skill of platform.skills) {
    const { definition } = skill;
    server.registerTool(
      definition.name,
      {
        description: definition.description,
        inputSchema: toZodShape(definition.input_schema),
      },
      async (args, extra) => {
        // Prefer the per-call `_meta.runId` over the connection header: the
        // header is connection-scoped and would misattribute steps if a client
        // ever reused one connection across runs. Header stays as the fallback
        // for clients that don't send `_meta`.
        const runId = extra?._meta?.runId || ctx.runId || null;
        try {
          return asToolResult(
            await runTraced({ name: definition.name, input: args || {}, ctx: { ...ctx, runId } })
          );
        } catch (err) {
          // Report the failure to the model as tool output, not as a protocol
          // error: the agent should be able to read it and try something else.
          return asToolError(err.message);
        }
      }
    );
  }
}

// --- Demo-facing surface -----------------------------------------------------
// Resources and prompts exist so the server is a complete MCP citizen when opened
// in Claude Code / Cursor. The runtime agent does NOT use them: a ReAct loop only
// ever emits tool calls, so anything the agent must reach has to be a TOOL. The
// patient files are therefore exposed BOTH ways — as tools (for the agent) and as
// a resource (for a human browsing the server).
function registerResources(server, ctx) {
  server.registerResource(
    'patient-file',
    // The `list` callback is what makes the documents actually BROWSABLE in an
    // MCP client. Without it the template is advertised but resources/list comes
    // back empty, so the demo surface looks broken. It enumerates exactly the
    // files this doctor may see, because it goes through the same skill the agent
    // uses — no second authorization path to get wrong.
    new ResourceTemplate('patient-file://{fileId}', {
      list: async () => {
        try {
          const { files } = await listPatientFiles.handler({}, ctx);
          return {
            resources: files.map((f) => ({
              uri: `patient-file://${f.id}`,
              name: f.fileName,
              description: `Shared by patient ${f.patientId} on ${f.uploadedAt}`,
              mimeType: 'text/plain',
            })),
          };
        } catch {
          // A browsing client should see an empty list, not a protocol error,
          // when file-service is down or the caller has nothing shared.
          return { resources: [] };
        }
      },
    }),
    {
      title: 'Patient document',
      description:
        'A medical document shared with the calling doctor, addressed by file id. Demo surface for MCP clients — the agent uses the read_patient_file tool.',
      mimeType: 'text/plain',
    },
    async (uri, { fileId }) => {
      const doc = await readPatientFile.handler({ fileId }, ctx);
      return {
        contents: [{ uri: uri.href, mimeType: 'text/plain', text: doc.text ?? doc.note ?? '' }],
      };
    }
  );
}

function registerPrompts(server) {
  server.registerPrompt(
    'summarise-and-cite',
    {
      title: 'Summarise with citations',
      description: 'Summarise a clinical topic, grounding every claim in a named source.',
      argsSchema: { topic: z.string().describe('The clinical topic to summarise.') },
    },
    ({ topic }) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Summarise the current evidence on: ${topic}.\n\nGround every claim in a source you actually retrieved, name the source inline, and state clearly where the evidence is weak or absent. Do not diagnose or prescribe.`,
          },
        },
      ],
    })
  );

  server.registerPrompt(
    'soap-note',
    {
      title: 'Draft a SOAP note',
      description: 'Draft a SOAP-structured clinical note from consultation details.',
      argsSchema: {
        details: z.string().describe('Consultation details to structure.'),
      },
    },
    ({ details }) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Draft a SOAP note (Subjective, Objective, Assessment, Plan) from the following consultation details. Mark anything you are inferring rather than told, and leave the Assessment for the clinician to confirm.\n\n${details}`,
          },
        },
      ],
    })
  );
}

/**
 * @param {object} ctx  { token, userId, role, runId } from the request's headers
 * @returns {McpServer}
 */
function buildServer(ctx) {
  const server = new McpServer(
    { name: NAME, version: VERSION },
    {
      // Capability negotiation: what this server tells a connecting client it can
      // do. `listChanged` is advertised because tools/resources are registered
      // per connection.
      capabilities: {
        tools: { listChanged: true },
        resources: { listChanged: true },
        prompts: { listChanged: true },
      },
      instructions:
        'Clinical skills for the CareLoop platform. Tools act as the calling doctor and are limited to that doctor\'s own patients and documents.',
    }
  );

  registerTools(server, ctx);
  registerResources(server, ctx);
  registerPrompts(server);
  return server;
}

module.exports = { buildServer, NAME, VERSION, redact, summarize };
