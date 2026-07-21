// The PLATFORM skill set — the tools healthcare-mcp exposes over MCP, and the
// same ones agent-service runs in-process when no MCP server is configured.
// Each skill module exports { definition, handler(input, ctx) }.
//
// Every skill here reaches a sibling service (file, appointment) or an external
// provider (Brave, Voyage/Chroma) using the CALLER's own JWT from `ctx`, so it is
// safe to expose remotely. The local-disk `read_file` skill is deliberately NOT
// in this set: it reads the agent host's filesystem, which must never be
// reachable over the network. agent-service composes it in separately.
const webSearch = require('./webSearch');
const getAppointment = require('./getAppointment');
const listPatientFiles = require('./listPatientFiles');
const readPatientFile = require('./readPatientFile');
const retrieveDocs = require('./retrieveDocs');

const skills = [webSearch, getAppointment, listPatientFiles, readPatientFile, retrieveDocs];

// Build the {definitions, handlers} pair from a skill list, failing fast on a
// duplicate tool name — the Claude API rejects a tools array with two identical
// names, and it is an easy mistake when adding a skill. Exported so agent-service
// can build its own superset (platform skills + local read_file) the same way.
function build(list) {
  const names = list.map((s) => s.definition.name);
  const dupes = names.filter((n, i) => names.indexOf(n) !== i);
  if (dupes.length) {
    throw new Error(`Duplicate skill name(s): ${[...new Set(dupes)].join(', ')}`);
  }
  return {
    // Anthropic-format tool definitions passed to messages.create({ tools }).
    definitions: list.map((s) => s.definition),
    // name -> handler(input, ctx)
    handlers: Object.fromEntries(list.map((s) => [s.definition.name, s.handler])),
  };
}

module.exports = { ...build(skills), skills, build };
