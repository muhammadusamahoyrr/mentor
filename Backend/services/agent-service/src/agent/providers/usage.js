// Token accounting across providers.
//
// ⚠️ BE HONEST ABOUT THIS NUMBER. Each provider reports usage differently, and
// some do not always report it at all:
//
//   Anthropic   usage.input_tokens / output_tokens      — reliable
//   OpenRouter  usage.prompt_tokens / completion_tokens — reliable, sometimes
//                                                          absent while streaming
//   Gemini      usageMetadata.*TokenCount               — only at stream END,
//                                                          and sometimes omitted
//
// So a run's token total is a FLOOR, not a measurement: calls whose usage the
// provider withheld contribute 0. `reported`/`calls` says how much of the run the
// number actually covers, which is what stops it being quoted as if it were exact.
// Latency (ms) is the reliable half of the cost story; tokens are indicative.

/**
 * Normalize one response's usage into { inputTokens, outputTokens }.
 * Returns null when the provider told us nothing.
 */
function readUsage(response) {
  const u = response?.usage || response?.usageMetadata;
  if (!u || typeof u !== 'object') return null;

  const inputTokens = u.input_tokens ?? u.prompt_tokens ?? u.promptTokenCount;
  const outputTokens = u.output_tokens ?? u.completion_tokens ?? u.candidatesTokenCount;

  if (inputTokens === undefined && outputTokens === undefined) return null;

  return {
    inputTokens: Number(inputTokens) || 0,
    outputTokens: Number(outputTokens) || 0,
  };
}

/** A fresh, empty accumulator. */
const emptyUsage = () => ({ inputTokens: 0, outputTokens: 0, calls: 0, reported: 0 });

/**
 * Fold one response into an accumulator. Every model call increments `calls`;
 * only the ones that actually reported usage increment `reported`.
 */
function addUsage(acc, response) {
  acc.calls += 1;
  const u = readUsage(response);
  if (!u) return acc;
  acc.inputTokens += u.inputTokens;
  acc.outputTokens += u.outputTokens;
  acc.reported += 1;
  return acc;
}

/** Combine accumulators (a supervisor summing its workers). */
function mergeUsage(...accs) {
  return accs.filter(Boolean).reduce((out, a) => {
    out.inputTokens += a.inputTokens || 0;
    out.outputTokens += a.outputTokens || 0;
    out.calls += a.calls || 0;
    out.reported += a.reported || 0;
    return out;
  }, emptyUsage());
}

/** Total tokens plus how trustworthy the figure is. */
function summarize(acc) {
  const a = acc || emptyUsage();
  return {
    ...a,
    totalTokens: a.inputTokens + a.outputTokens,
    // false when any call withheld usage — the total is then a floor.
    complete: a.calls > 0 && a.reported === a.calls,
  };
}

module.exports = { readUsage, addUsage, mergeUsage, emptyUsage, summarize };
