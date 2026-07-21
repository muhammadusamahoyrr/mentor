// agent-service's in-process skill set = the shared PLATFORM skills (the same
// ones healthcare-mcp exposes over MCP) PLUS the local-disk `read_file` reader.
//
// read_file is composed in here rather than in the shared registry on purpose:
// it reads this host's own docs folder, so it must never be reachable over the
// network. It stays available to the CLI harness (scripts/ask.js) and to the
// in-process gateway used offline and in tests.
//
// This registry is the FALLBACK tool backend. When HEALTHCARE_MCP_URL is set the
// gateway routes tool calls to the MCP server instead — see ./gateway.js.
const platform = require('../../../../../shared/agent/tools/registry');
const readFile = require('./readFile');

module.exports = platform.build([...platform.skills, readFile]);
