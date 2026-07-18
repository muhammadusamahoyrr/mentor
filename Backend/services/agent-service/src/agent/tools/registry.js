// The skill (tool) registry. Each skill module exports { definition, handler }.
// Phase 2 adds the platform skills (readFile→file-service, getVitals,
// getAppointment) and Phase 4 adds retrieveDocs; they all register here.
const webSearch = require('./webSearch');
const readFile = require('./readFile');
const getAppointment = require('./getAppointment');
const listPatientFiles = require('./listPatientFiles');
const readPatientFile = require('./readPatientFile');
const retrieveDocs = require('./retrieveDocs');

const skills = [
  webSearch,
  readFile,
  getAppointment,
  listPatientFiles,
  readPatientFile,
  retrieveDocs,
];

// Fail fast on a duplicate tool name — the Claude API rejects a tools array with
// two identical names, and it is an easy mistake when adding a skill.
const names = skills.map((s) => s.definition.name);
const dupes = names.filter((n, i) => names.indexOf(n) !== i);
if (dupes.length) {
  throw new Error(`Duplicate skill name(s): ${[...new Set(dupes)].join(', ')}`);
}

module.exports = {
  // Anthropic-format tool definitions passed to messages.create({ tools }).
  definitions: skills.map((s) => s.definition),
  // name -> handler(input, ctx)
  handlers: Object.fromEntries(skills.map((s) => [s.definition.name, s.handler])),
};
