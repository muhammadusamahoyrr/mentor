#!/usr/bin/env node
// The stdio variant — the same server, spoken over stdin/stdout so it can be
// dropped into Claude Code, Cursor or any desktop MCP client:
//
//   {
//     "mcpServers": {
//       "healthcare": {
//         "command": "node",
//         "args": ["Backend/services/healthcare-mcp/src/stdio.js"],
//         "env": { "MCP_DOCTOR_JWT": "<a doctor JWT>", "JWT_SECRET": "...", ... }
//       }
//     }
//   }
//
// There is no transport to read a per-request Authorization header from here, so
// the doctor's JWT comes from MCP_DOCTOR_JWT — this process IS one doctor's
// session. That makes it a demo/inspection tool: the HTTP transport is what
// agent-service uses in the running system, because there one process serves many
// doctors and the token must travel per request.
require('dotenv').config();
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const jwt = require('jsonwebtoken');
const { buildServer } = require('./mcpServer');

const token = process.env.MCP_DOCTOR_JWT;
if (!token) {
  console.error('MCP_DOCTOR_JWT is not set — the stdio server has no caller to act as.');
  process.exit(1);
}

const decoded = jwt.decode(token) || {};
const userId = String(decoded.id ?? decoded.userId ?? '');
if (!userId) {
  console.error('Could not read a user id from MCP_DOCTOR_JWT.');
  process.exit(1);
}

(async () => {
  const server = buildServer({ token, userId, role: decoded.role, runId: null });
  await server.connect(new StdioServerTransport());
  // Never log to stdout here — stdout IS the protocol channel.
  console.error(`healthcare-mcp (stdio) ready, acting as user ${userId}`);
})().catch((err) => {
  console.error('healthcare-mcp (stdio) failed to start:', err.message);
  process.exit(1);
});
