// retrieve_docs skill — semantic search over the medical documents that have
// been ingested for a patient. Retrieval is scoped two ways:
//   1. patientId  — the PHI hard guard (also enforced in vector/chroma.js).
//   2. doctorId    — only chunks from documents shared with THIS doctor were
//      ingested tagged with their id, so a doctor can never retrieve a document
//      they could not have opened directly. Same authorization as read_patient_file.
const embed = require('../../vector/embed');
const chroma = require('../../vector/chroma');

const COLLECTION = 'clinical_docs';

const definition = {
  name: 'retrieve_docs',
  description:
    "Semantic search over the patient's own medical documents shared with you. Provide a patientId and a query; returns the most relevant passages with their source. Prefer this over web_search when the answer may be in the patient's records.",
  input_schema: {
    type: 'object',
    properties: {
      patientId: { type: 'string', description: 'The patient whose documents to search.' },
      query: { type: 'string', description: 'What to look for.' },
      k: { type: 'integer', description: 'Max passages (default 5).' },
    },
    required: ['patientId', 'query'],
  },
};

async function handler({ patientId, query, k = 5 }, ctx) {
  // Defense in depth: guard here too, so the skill can never be the thing that
  // issues an unscoped search even if chroma.query changed.
  if (!patientId) {
    throw new Error('retrieve_docs requires a patientId — refusing to search unscoped');
  }
  if (!ctx || !ctx.userId) {
    throw new Error('retrieve_docs needs an authenticated caller');
  }

  const [queryEmbedding] = await embed.embed([query]);
  const matches = await chroma.query(COLLECTION, {
    queryEmbedding,
    filter: { patientId, doctorId: ctx.userId },
    k,
  });

  return {
    patientId,
    count: matches.length,
    passages: matches.map((m) => ({
      text: m.text,
      source: m.metadata?.docName,
      sourceType: m.metadata?.sourceType,
      sourceId: m.metadata?.sourceId,
    })),
  };
}

module.exports = { definition, handler };
