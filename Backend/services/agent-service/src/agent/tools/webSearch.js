// web_search skill — Brave Search API. Swappable for SerpAPI behind this same
// definition without the agent loop noticing.
const injectionGuard = require('../../security/injectionGuard');

const BRAVE_ENDPOINT = 'https://api.search.brave.com/res/v1/web/search';

const definition = {
  name: 'web_search',
  description:
    'Search the public web for current medical literature, clinical guidelines and reference information. Returns a list of {title, url, snippet}. Use for external knowledge only — never for patient-specific data.',
  input_schema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'The search query.' },
      count: { type: 'integer', description: 'Max results to return (default 5, max 10).' },
    },
    required: ['query'],
  },
};

async function handler({ query, count = 5 }) {
  const key = process.env.BRAVE_API_KEY;
  if (!key) {
    throw new Error('BRAVE_API_KEY is not set — the web_search skill cannot run');
  }

  const n = Math.min(Math.max(Number(count) || 5, 1), 10);
  const url = `${BRAVE_ENDPOINT}?q=${encodeURIComponent(query)}&count=${n}`;

  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'X-Subscription-Token': key },
  });
  if (!res.ok) {
    throw new Error(`Brave search returned ${res.status}`);
  }

  const data = await res.json();
  let injectionFlagged = false;
  const results = (data.web?.results || []).slice(0, n).map((r) => {
    // Web snippets are untrusted content too — neutralize any injection attempt.
    const g = injectionGuard.guard(r.description || '');
    if (g.injectionFlagged) injectionFlagged = true;
    return { title: r.title, url: r.url, snippet: g.text };
  });

  return { query, count: results.length, injectionFlagged, results };
}

module.exports = { definition, handler };
