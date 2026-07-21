// Embeddings provider (Voyage). One interface, one place to swap the model or
// vendor. Returns one vector per input string, in order.
const ENDPOINT = 'https://api.voyageai.com/v1/embeddings';

async function embed(texts) {
  const key = process.env.VOYAGE_API_KEY;
  if (!key) {
    throw new Error('VOYAGE_API_KEY is not set — cannot embed');
  }
  if (!Array.isArray(texts) || texts.length === 0) return [];

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ input: texts, model: process.env.VOYAGE_MODEL || 'voyage-3' }),
  });
  if (!res.ok) {
    throw new Error(`Voyage embeddings failed: ${res.status}`);
  }
  const data = await res.json();
  return (data.data || []).map((d) => d.embedding);
}

module.exports = { embed };
