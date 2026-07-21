// The Week-5 path, end to end: agent-service running its ReAct loop with the
// tools executing inside the REAL healthcare-mcp server, over a real Streamable
// HTTP socket. Only the model and the sibling services are faked.
//
// This is the milestone the whole refactor exists to prove — auth passthrough and
// runId propagation across the MCP boundary — so it is deliberately an
// integration test rather than a mock of the client.

// Must be set before healthcare-mcp's auth module is required: it reads these at
// import and refuses to load without them.
process.env.INTERNAL_SERVICE_TOKEN = 'test-internal-token-value';

const http = require('http');
const jwt = require('jsonwebtoken');

const mcpApp = require('../../../healthcare-mcp/src/server');
const gateway = require('../agent/tools/gateway');
const mcpClient = require('../agent/mcp/client');
const trace = require('../../../../shared/trace/traceStore');
const { runAgent } = require('../agent/loop');

// Requiring healthcare-mcp's server runs its dotenv.config(), which reads the
// .env of the CWD — this service's — and re-injects the real API keys that
// jest.setup deliberately removed. Strip them again, or a test that expects a
// skill to fail closed would instead call the live Brave/Voyage API.
process.env.BRAVE_API_KEY = '';
process.env.VOYAGE_API_KEY = '';

const DOCTOR = jwt.sign({ id: 'doc-42', role: 'doctor' }, process.env.JWT_SECRET);

let server;
let realFetch;

beforeAll((done) => {
  realFetch = global.fetch;
  server = http.createServer(mcpApp).listen(0, () => {
    process.env.HEALTHCARE_MCP_URL = `http://127.0.0.1:${server.address().port}/mcp`;
    done();
  });
});

afterAll((done) => {
  global.fetch = realFetch;
  delete process.env.HEALTHCARE_MCP_URL;
  server.close(done);
});

beforeEach(() => {
  trace._resetMemory();
  mcpClient._resetCache();
});
afterEach(() => {
  global.fetch = realFetch;
});

// Stub only the sibling services; MCP traffic to our own test server must pass
// through, since the client transport speaks over global.fetch as well.
function mockSiblingFetch(handler) {
  const calls = [];
  global.fetch = async (url, init) => {
    const href = String(url);
    if (href.startsWith(`http://127.0.0.1:${server.address().port}`)) {
      return realFetch(url, init);
    }
    calls.push({ url: href, headers: init?.headers || {} });
    return handler(href, init);
  };
  return calls;
}

const filesResponse = () => ({
  status: 200,
  ok: true,
  json: async () => [{ _id: 'f9', fileName: 'ecg.pdf', patientId: 'p7', uploadedAt: '2026-02-02' }],
});

// A fake model that asks for one tool, then answers.
function fakeClient(script) {
  let i = 0;
  const calls = [];
  return {
    _calls: calls,
    messages: {
      create: async (params) => {
        calls.push(params);
        return script[i++];
      },
    },
  };
}

describe('gateway backend selection', () => {
  it('uses the MCP backend when HEALTHCARE_MCP_URL is set', async () => {
    const skills = await gateway.open({ token: DOCTOR, userId: 'doc-42' });
    expect(skills.kind).toBe('mcp');
    await skills.close();
  });

  it('falls back to in-process when no MCP server is configured', async () => {
    const saved = process.env.HEALTHCARE_MCP_URL;
    delete process.env.HEALTHCARE_MCP_URL;
    try {
      const skills = await gateway.open({});
      expect(skills.kind).toBe('in-process');
      // The local set keeps read_file; the MCP set never exposes it.
      expect(skills.definitions.map((d) => d.name)).toContain('read_file');
    } finally {
      process.env.HEALTHCARE_MCP_URL = saved;
    }
  });

  it('serves the MCP tool list in the shape the model providers expect', async () => {
    const skills = await gateway.open({ token: DOCTOR, userId: 'doc-42' });
    const names = skills.definitions.map((d) => d.name).sort();

    expect(names).toEqual([
      'get_appointment',
      'list_patient_files',
      'read_patient_file',
      'retrieve_docs',
      'web_search',
    ]);
    // Anthropic/Gemini shape: input_schema, not MCP's inputSchema.
    for (const def of skills.definitions) {
      expect(def.input_schema.type).toBe('object');
      expect(def.inputSchema).toBeUndefined();
    }
    await skills.close();
  });
});

describe('the ReAct loop with tools running over MCP', () => {
  it('executes a tool in the MCP server and feeds the result back to the model', async () => {
    const seen = mockSiblingFetch(async () => filesResponse());

    const client = fakeClient([
      {
        stop_reason: 'tool_use',
        content: [{ type: 'tool_use', id: 'tu1', name: 'list_patient_files', input: {} }],
      },
      { stop_reason: 'end_turn', content: [{ type: 'text', text: 'You have ecg.pdf shared.' }] },
    ]);

    const { answer, toolOutcomes } = await runAgent({
      question: 'What files do I have?',
      ctx: { token: DOCTOR, userId: 'doc-42' },
      client,
    });

    expect(answer).toContain('ecg.pdf');
    expect(toolOutcomes).toEqual([{ name: 'list_patient_files', thin: false }]);

    // The skill really ran on the far side and reached file-service as the doctor.
    expect(seen).toHaveLength(1);
    expect(seen[0].url).toContain('/api/files/my');
    expect(seen[0].headers.Authorization).toBe(`Bearer ${DOCTOR}`);

    // The tool result came back through MCP into the model's next turn.
    const toolResult = client._calls[1].messages
      .flatMap((m) => (Array.isArray(m.content) ? m.content : []))
      .find((b) => b.type === 'tool_result');
    expect(toolResult.is_error).toBe(false);
    expect(toolResult.content).toContain('ecg.pdf');
  });

  it('surfaces an MCP-side skill failure to the model instead of crashing', async () => {
    // BRAVE_API_KEY is unset, so web_search fails inside the MCP server.
    const client = fakeClient([
      {
        stop_reason: 'tool_use',
        content: [{ type: 'tool_use', id: 'tu1', name: 'web_search', input: { query: 'x' } }],
      },
      { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Search is unavailable.' }] },
    ]);

    const { answer } = await runAgent({
      question: 'search something',
      ctx: { token: DOCTOR, userId: 'doc-42' },
      client,
    });

    expect(answer).toContain('unavailable');
    const toolResult = client._calls[1].messages
      .flatMap((m) => (Array.isArray(m.content) ? m.content : []))
      .find((b) => b.type === 'tool_result');
    expect(toolResult.is_error).toBe(true);
    expect(toolResult.content).toMatch(/BRAVE_API_KEY/);
  });
});

describe('auth passthrough across the MCP boundary', () => {
  it('refuses to open a gateway without the internal service token', async () => {
    const saved = process.env.INTERNAL_SERVICE_TOKEN;
    delete process.env.INTERNAL_SERVICE_TOKEN;
    try {
      await expect(gateway.open({ token: DOCTOR, userId: 'doc-42' })).rejects.toThrow(
        /INTERNAL_SERVICE_TOKEN/
      );
    } finally {
      process.env.INTERNAL_SERVICE_TOKEN = saved;
    }
  });

  it('refuses to open a gateway with no caller JWT (the MCP server rejects it)', async () => {
    await expect(gateway.open({ userId: 'doc-42' })).rejects.toThrow();
  });
});

describe('runId propagation across the MCP boundary', () => {
  it('records the MCP-side tool steps under the runId the agent minted', async () => {
    mockSiblingFetch(async () => filesResponse());
    const runId = 'run-across-the-boundary';

    const client = fakeClient([
      {
        stop_reason: 'tool_use',
        content: [{ type: 'tool_use', id: 'tu1', name: 'list_patient_files', input: {} }],
      },
      { stop_reason: 'end_turn', content: [{ type: 'text', text: 'done' }] },
    ]);

    await runAgent({
      question: 'files?',
      ctx: { token: DOCTOR, userId: 'doc-42', runId },
      client,
    });

    // agent-service never executed the tool — healthcare-mcp did — yet the steps
    // are filed under this run, which is the whole point of forwarding x-run-id.
    const steps = await trace.get(runId);
    expect(steps.length).toBeGreaterThanOrEqual(2);
    expect(steps.every((s) => s.service === 'healthcare-mcp')).toBe(true);
    expect(steps[0]).toMatchObject({ phase: 'start', tool: 'list_patient_files' });
    expect(steps[1]).toMatchObject({ phase: 'end', tool: 'list_patient_files', ok: true });
  });
});
