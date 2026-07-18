// A tiny in-memory stand-in for the ChromaDB client, used to test the vector
// layer without a running Chroma. It honours the `where` filter so the PHI-scope
// (cross-patient) test is meaningful.

function clauseMatch(clause, meta) {
  const [key, cond] = Object.entries(clause)[0];
  return meta[key] === cond.$eq;
}
function whereMatches(where, meta) {
  if (!where) return true;
  if (where.$and) return where.$and.every((c) => clauseMatch(c, meta));
  return clauseMatch(where, meta);
}

function makeFakeChroma() {
  const store = [];
  let lastWhere;
  const collection = {
    upsert: async ({ ids, embeddings, metadatas, documents }) => {
      ids.forEach((id, i) =>
        store.push({ id, embedding: embeddings[i], metadata: metadatas[i], document: documents[i] })
      );
    },
    query: async ({ nResults, where }) => {
      lastWhere = where;
      const hits = store.filter((s) => whereMatches(where, s.metadata)).slice(0, nResults);
      return {
        documents: [hits.map((h) => h.document)],
        metadatas: [hits.map((h) => h.metadata)],
        distances: [hits.map(() => 0.1)],
      };
    },
  };
  return {
    getOrCreateCollection: async () => collection,
    lastWhere: () => lastWhere,
    _store: store,
  };
}

module.exports = { makeFakeChroma };
