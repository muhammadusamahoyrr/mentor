// Split a document into overlapping character windows for embedding. Character-
// based (not token-based) on purpose: deterministic, dependency-free and easy to
// test. ~1500 chars ≈ ~400 tokens, a good retrieval granularity.
function chunk(text, { size = 1500, overlap = 200 } = {}) {
  const clean = String(text || '').replace(/[ \t]+\n/g, '\n').trim();
  if (!clean) return [];
  if (overlap >= size) throw new Error('overlap must be smaller than size');

  const out = [];
  let i = 0;
  while (i < clean.length) {
    out.push(clean.slice(i, i + size));
    if (i + size >= clean.length) break;
    i += size - overlap;
  }
  return out;
}

module.exports = { chunk };
