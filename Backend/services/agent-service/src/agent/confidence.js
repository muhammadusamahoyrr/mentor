// Confidence resolution for an agent answer.
//
// Two independent signals decide the final level, and the MORE CAUTIOUS one wins:
//   1. The model's self-assessment — it ends its answer with a line
//      "CONFIDENCE: high|medium|low" which we parse out and strip.
//   2. Grounding — if the agent leaned on retrieval (retrieve_docs) and it came
//      back empty/thin, the answer is not grounded in the patient's data, so we
//      force LOW no matter how assured the prose sounds. Confident phrasing over
//      no evidence is exactly the failure mode this guards against.

const LEVELS = ['low', 'medium', 'high'];
const rank = (l) => LEVELS.indexOf(l);

// Pull a trailing "CONFIDENCE: <level>" line off the answer and remove it from
// the visible text.
function parseConfidence(answer) {
  const text = String(answer || '');
  const m = text.match(/\n?\s*CONFIDENCE:\s*(high|medium|low)\b[.\s]*$/i);
  if (!m) return { level: null, answer: text.trim() };
  return { level: m[1].toLowerCase(), answer: text.slice(0, m.index).trim() };
}

// Grounding floor: if retrieve_docs was used and every call returned nothing
// useful, cap confidence at low.
function dataFloor(toolOutcomes = []) {
  const retrievals = toolOutcomes.filter((t) => t.name === 'retrieve_docs');
  if (retrievals.length && retrievals.every((t) => t.thin)) return 'low';
  return 'high';
}

function resolveConfidence(modelLevel, toolOutcomes = []) {
  const model = LEVELS.includes(modelLevel) ? modelLevel : 'medium';
  const floor = dataFloor(toolOutcomes);
  return rank(model) <= rank(floor) ? model : floor; // the more cautious of the two
}

// True if a tool result carried no useful data (used to compute `thin`).
function isThinResult(name, result) {
  if (!result || result.error) return true;
  if (name === 'retrieve_docs' || name === 'web_search' || name === 'list_patient_files') {
    return !result.count;
  }
  return false;
}

const LOW_PREFIX = 'Uncertain — please verify with the doctor.\n\n';

module.exports = { parseConfidence, resolveConfidence, dataFloor, isThinResult, LOW_PREFIX, LEVELS };
