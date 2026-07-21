// MCP integration: a real Client speaking Streamable HTTP to a real server over
// a real socket. Only the sibling services are faked (via global fetch), so the
// transport, capability negotiation, auth and tool dispatch are all exercised.
const http = require('http');
const jwt = require('jsonwebtoken');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const {
  StreamableHTTPClientTransport,
} = require('@modelcontextprotocol/sdk/client/streamableHttp.js');

const app = require('../server');
const trace = require('../../../../shared/trace/traceStore');

const INTERNAL = process.env.INTERNAL_SERVICE_TOKEN;
const DOCTOR = jwt.sign({ id: 'doc-1', role: 'doctor' }, process.env.JWT_SECRET);

let server;
let baseUrl;
let realFetch;

beforeAll((done) => {
  realFetch = global.fetch;
  server = http.createServer(app).listen(0, () => {
    baseUrl = `http://127.0.0.1:${server.address().port}/mcp`;
    done();
  });
});

afterAll((done) => {
  global.fetch = realFetch;
  server.close(done);
});

beforeEach(() => trace._resetMemory());
afterEach(() => {
  global.fetch = realFetch;
});

// Stub ONLY the sibling-service calls a skill makes. The MCP client transport
// speaks over global.fetch too, so traffic to our own test server has to pass
// straight through — otherwise the stub breaks the protocol it is meant to test.
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

// Connect a client with the given headers; returns the connected Client.
async function connect(headers) {
  const client = new Client({ name: 'test-client', version: '1.0.0' });
  const transport = new StreamableHTTPClientTransport(new URL(baseUrl), {
    requestInit: { headers },
  });
  await client.connect(transport);
  return client;
}

const goodHeaders = (extra = {}) => ({
  'x-internal-token': INTERNAL,
  Authorization: `Bearer ${DOCTOR}`,
  ...extra,
});

describe('auth on the MCP transport', () => {
  it('rejects a connection with no internal service token', async () => {
    await expect(connect({ Authorization: `Bearer ${DOCTOR}` })).rejects.toThrow();
  });

  it('rejects a connection with a WRONG internal service token', async () => {
    await expect(
      connect({ 'x-internal-token': 'not-the-token', Authorization: `Bearer ${DOCTOR}` })
    ).rejects.toThrow();
  });

  it('rejects a connection carrying the internal token but no caller JWT', async () => {
    await expect(connect({ 'x-internal-token': INTERNAL })).rejects.toThrow();
  });

  it('rejects a caller JWT signed with the wrong secret', async () => {
    const forged = jwt.sign({ id: 'doc-1', role: 'doctor' }, 'wrong-secret');
    await expect(
      connect({ 'x-internal-token': INTERNAL, Authorization: `Bearer ${forged}` })
    ).rejects.toThrow();
  });
});

describe('capability negotiation and tool listing', () => {
  it('lists exactly the five platform skills, and never the local read_file', async () => {
    const client = await connect(goodHeaders());
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();

    expect(names).toEqual([
      'get_appointment',
      'list_patient_files',
      'read_patient_file',
      'retrieve_docs',
      'web_search',
    ]);
    // read_file reads the agent host's own disk — it must never be reachable
    // over the network.
    expect(names).not.toContain('read_file');
    await client.close();
  });

  it('advertises its tool/resource/prompt capabilities to the client', async () => {
    const client = await connect(goodHeaders());
    const caps = client.getServerCapabilities();
    expect(caps.tools).toBeDefined();
    expect(caps.resources).toBeDefined();
    expect(caps.prompts).toBeDefined();
    await client.close();
  });

  it('exposes each tool with a usable JSON Schema (translated from ours)', async () => {
    const client = await connect(goodHeaders());
    const { tools } = await client.listTools();

    const read = tools.find((t) => t.name === 'read_patient_file');
    expect(read.inputSchema.type).toBe('object');
    expect(read.inputSchema.properties.fileId).toBeDefined();
    expect(read.inputSchema.required).toContain('fileId');

    // list_patient_files takes no arguments — still a valid object schema.
    const list = tools.find((t) => t.name === 'list_patient_files');
    expect(list.inputSchema.type).toBe('object');
    await client.close();
  });

  it('lets a client BROWSE the doctor\'s documents as resources', async () => {
    // Without a `list` callback on the template this comes back empty and the
    // demo surface looks broken in Claude Code / Cursor.
    mockSiblingFetch(async () => ({
      status: 200,
      ok: true,
      json: async () => [
        { _id: 'f1', fileName: 'labs.pdf', patientId: 'p1', uploadedAt: '2026-01-01' },
      ],
    }));

    const client = await connect(goodHeaders());
    const { resources } = await client.listResources();

    expect(resources).toHaveLength(1);
    expect(resources[0]).toMatchObject({ uri: 'patient-file://f1', name: 'labs.pdf' });
    await client.close();
  });

  it('reads a document through the resource surface', async () => {
    mockSiblingFetch(async () => ({
      status: 200,
      ok: true,
      headers: { get: () => 'text/plain' },
      arrayBuffer: async () => Buffer.from('ECG: normal sinus rhythm.'),
    }));

    const client = await connect(goodHeaders());
    const res = await client.readResource({ uri: 'patient-file://f1' });

    expect(res.contents[0].text).toContain('normal sinus rhythm');
    await client.close();
  });

  it('offers the demo-only prompts', async () => {
    const client = await connect(goodHeaders());
    const { prompts } = await client.listPrompts();
    expect(prompts.map((p) => p.name).sort()).toEqual(['soap-note', 'summarise-and-cite']);
    await client.close();
  });
});

describe('calling a tool as the authenticated doctor', () => {
  it('forwards the CALLER\'s JWT to the sibling service, and never puts it in the args', async () => {
    const seen = mockSiblingFetch(async () => ({
      status: 200,
      ok: true,
      json: async () => [
        { _id: 'f1', fileName: 'labs.pdf', patientId: 'p1', uploadedAt: '2026-01-01' },
      ],
    }));

    const client = await connect(goodHeaders());
    const result = await client.callTool({ name: 'list_patient_files', arguments: {} });

    // The skill reached file-service with the doctor's own bearer token.
    expect(seen).toHaveLength(1);
    expect(seen[0].url).toContain('/api/files/my');
    expect(seen[0].headers.Authorization).toBe(`Bearer ${DOCTOR}`);

    const payload = JSON.parse(result.content[0].text);
    expect(payload.count).toBe(1);
    expect(payload.files[0].fileName).toBe('labs.pdf');

    await client.close();
  });

  it('returns a skill failure as tool output the model can read, not a protocol crash', async () => {
    // BRAVE_API_KEY is unset in jest.setup, so web_search fails closed.
    const client = await connect(goodHeaders());
    const result = await client.callTool({ name: 'web_search', arguments: { query: 'anything' } });

    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0].text).error).toMatch(/BRAVE_API_KEY/);
    await client.close();
  });

  it('rejects arguments that do not match the translated schema, before the skill runs', async () => {
    // If the schema translation were lossy this would sail through to the skill.
    // fileId is declared `string`, so a number must be refused at the boundary —
    // reported as a readable tool error rather than a thrown protocol fault, so
    // the model can correct itself and retry.
    const calls = mockSiblingFetch(async () => {
      throw new Error('the skill must never be reached with invalid arguments');
    });

    const client = await connect(goodHeaders());
    const result = await client.callTool({
      name: 'read_patient_file',
      arguments: { fileId: 12345 },
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/expected string, received number/);
    expect(calls).toHaveLength(0); // never reached file-service
    await client.close();
  });
});

describe('the MCP server writes its own trace steps', () => {
  it('records start and end for a tool call under the caller\'s runId', async () => {
    mockSiblingFetch(async () => ({ status: 200, ok: true, json: async () => [] }));

    const runId = 'run-under-test';
    const client = await connect(goodHeaders({ 'x-run-id': runId }));
    await client.callTool({ name: 'list_patient_files', arguments: {} });

    const steps = await trace.get(runId);
    expect(steps).toHaveLength(2);
    expect(steps[0]).toMatchObject({
      service: 'healthcare-mcp',
      type: 'tool',
      phase: 'start',
      tool: 'list_patient_files',
    });
    expect(steps[1]).toMatchObject({ phase: 'end', tool: 'list_patient_files', ok: true });
    expect(typeof steps[1].ms).toBe('number');

    await client.close();
  });

  it('takes the runId from the per-call _meta even with NO connection header', async () => {
    // _meta travels with the individual call, so it keeps working if a client
    // ever pools or reuses one connection across runs — which a header would not.
    mockSiblingFetch(async () => ({ status: 200, ok: true, json: async () => [] }));

    const client = await connect(goodHeaders()); // deliberately no x-run-id
    await client.callTool({
      name: 'list_patient_files',
      arguments: {},
      _meta: { runId: 'run-from-meta' },
    });

    const steps = await trace.get('run-from-meta');
    expect(steps).toHaveLength(2);
    expect(steps[0]).toMatchObject({ phase: 'start', tool: 'list_patient_files' });
    await client.close();
  });

  it('prefers the per-call _meta runId over the connection header', async () => {
    mockSiblingFetch(async () => ({ status: 200, ok: true, json: async () => [] }));

    const client = await connect(goodHeaders({ 'x-run-id': 'run-from-header' }));
    await client.callTool({
      name: 'list_patient_files',
      arguments: {},
      _meta: { runId: 'run-from-meta-wins' },
    });

    expect(await trace.get('run-from-meta-wins')).toHaveLength(2);
    expect(await trace.get('run-from-header')).toHaveLength(0);
    await client.close();
  });

  it('records the tool OUTPUT summary, not just the timing', async () => {
    mockSiblingFetch(async () => ({
      status: 200,
      ok: true,
      json: async () => [
        { _id: 'f1', fileName: 'labs.pdf', patientId: 'p1', uploadedAt: '2026-01-01' },
      ],
    }));

    const client = await connect(goodHeaders({ 'x-run-id': 'run-with-output' }));
    await client.callTool({ name: 'list_patient_files', arguments: {} });

    const steps = await trace.get('run-with-output');
    const end = steps.find((s) => s.phase === 'end');
    expect(end.output).toMatchObject({ count: 1, files: '[1 item(s)]' });
    // The input is recorded too, so a trace answers "what went in and what came out".
    expect(steps[0].args).toEqual({});
    await client.close();
  });

  it('truncates a long output instead of storing a second copy of the document', async () => {
    const long = 'x'.repeat(5000);
    mockSiblingFetch(async () => ({
      status: 200,
      ok: true,
      headers: { get: () => 'text/plain' },
      arrayBuffer: async () => Buffer.from(long),
    }));

    const client = await connect(goodHeaders({ 'x-run-id': 'run-long-output' }));
    await client.callTool({ name: 'read_patient_file', arguments: { fileId: 'f1' } });

    const end = (await trace.get('run-long-output')).find((s) => s.phase === 'end');
    expect(end.output.text.length).toBeLessThan(400);
    expect(end.output.text).toMatch(/… \(\d+ chars\)$/);
    expect(end.output.chars).toBe(5000); // the real length is still reported
    await client.close();
  });

  it('records a failed tool call with ok:false and the reason', async () => {
    const runId = 'run-that-fails';
    const client = await connect(goodHeaders({ 'x-run-id': runId }));
    await client.callTool({ name: 'web_search', arguments: { query: 'x' } });

    const steps = await trace.get(runId);
    expect(steps[1]).toMatchObject({ phase: 'end', ok: false });
    expect(steps[1].error).toMatch(/BRAVE_API_KEY/);
    await client.close();
  });
});
