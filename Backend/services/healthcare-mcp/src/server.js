require('dotenv').config();
const express = require('express');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { mcpAuth } = require('./auth');
const { buildServer, NAME, VERSION } = require('./mcpServer');

const app = express();
app.use(express.json({ limit: '4mb' }));

// No CORS: this endpoint is service-to-service only (agent-service calls it with
// the internal token). A browser must never reach it directly.

app.get('/', (req, res) =>
  res.json({
    service: NAME,
    version: VERSION,
    status: 'running',
    transport: 'streamable-http',
    endpoints: {
      health: 'GET /health',
      mcp: 'POST /mcp   (headers: x-internal-token, Authorization: Bearer <doctor JWT>, x-run-id?)',
    },
    note: 'Tools act as the calling doctor. Run `npm run stdio` for the Claude Code / Cursor demo.',
  })
);

app.get('/health', (req, res) => res.json({ status: 'healthy', service: 'healthcare-mcp' }));

// The MCP endpoint. Stateless: a fresh server + transport per request, built
// around THIS caller's context, so concurrent doctors can never cross over.
// (Stateless also means no session store to leak or expire.)
app.post('/mcp', mcpAuth, async (req, res) => {
  const server = buildServer(req.mcpContext);
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

  // Tear both down when the response ends, or each request leaks a transport.
  res.on('close', () => {
    transport.close();
    server.close();
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error('[mcp] request failed:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'MCP request failed' });
    } else if (!res.writableEnded) {
      // Headers already went out (the transport had begun streaming), so we
      // cannot change the status — but we must still end the response, or the
      // client waits on a socket that will never produce another byte.
      res.end();
    }
  }
});

// GET/DELETE /mcp are for stateful sessions, which we do not use. Answer plainly
// instead of letting them fall through to a 404 that looks like a routing bug.
app.all('/mcp', (req, res) =>
  res.status(405).json({ error: 'This MCP server is stateless — use POST /mcp' })
);

const PORT = process.env.PORT || 3008;

if (require.main === module) {
  app.listen(PORT, () => console.log(`healthcare-mcp running on port ${PORT} (POST /mcp)`));
}

module.exports = app;
