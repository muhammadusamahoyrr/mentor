// ChromaDB access, wrapped so the rest of the app never touches the client
// directly — and so the PHI guard lives at the true query layer.
//
// THE PHI HARD GUARD: query() refuses, fail-closed, to run any search that is not
// scoped by a patientId. This is enforced here (not only in a CI test), so a bug
// that dropped the scope becomes an error in front of you, never a silent
// cross-patient leak. There is no code path to an unscoped query.

const GUARD_MESSAGE =
  'PHI guard: refusing to query the vector store without a patientId scope';

let _client = null;

// Tests inject a fake client; real use lazy-loads chromadb so importing this
// module never requires chromadb to be installed/running.
function setClient(client) {
  _client = client;
}

async function getClient() {
  if (_client) return _client;
  const { ChromaClient } = require('chromadb');
  _client = new ChromaClient({ path: process.env.CHROMA_URL || 'http://localhost:8000' });
  return _client;
}

async function getCollection(name) {
  const client = await getClient();
  return client.getOrCreateCollection({ name });
}

async function upsert(name, items) {
  if (!items.length) return;
  const col = await getCollection(name);
  await col.upsert({
    ids: items.map((i) => i.id),
    embeddings: items.map((i) => i.embedding),
    metadatas: items.map((i) => i.metadata),
    documents: items.map((i) => i.text),
  });
}

function assertScoped(filter) {
  const pid = filter && filter.patientId;
  if (pid === undefined || pid === null || pid === '') {
    throw new Error(GUARD_MESSAGE);
  }
}

function buildWhere(filter) {
  const clauses = Object.entries(filter).map(([k, v]) => ({ [k]: { $eq: v } }));
  return clauses.length === 1 ? clauses[0] : { $and: clauses };
}

async function query(name, { queryEmbedding, filter, k = 5 }) {
  assertScoped(filter); // fail-closed BEFORE any network call
  const col = await getCollection(name);
  const res = await col.query({
    queryEmbeddings: [queryEmbedding],
    nResults: k,
    where: buildWhere(filter),
  });

  const docs = res.documents?.[0] || [];
  const metas = res.metadatas?.[0] || [];
  const dists = res.distances?.[0] || [];
  return docs.map((text, i) => ({ text, metadata: metas[i], distance: dists[i] }));
}

module.exports = { setClient, getCollection, upsert, query, assertScoped, buildWhere, GUARD_MESSAGE };
