// Serial-vs-parallel measurement (week5.md §4.6 — "Report serial-vs-parallel
// latency/cost"). The comparison is itself a deliverable, and the doc is blunt
// that orchestration may not be a win here, so this exists to produce the number
// rather than to argue for a conclusion.
//
// The measurement logic lives here, apart from the CLI in scripts/benchmark.js,
// so it can be tested with a fake model instead of only being exercisable by
// spending real tokens.
//
// ⚠️ Latency is measured directly and is reliable. Tokens come from the provider
// and are a FLOOR — see providers/usage.js. Do not quote them as exact.

const { runAgentStream } = require('../loop');
const { summarize, emptyUsage } = require('../providers/usage');

// The three ways the same question can be answered.
const MODES = ['single', 'sequential', 'parallel'];

/**
 * Run one question in one mode and time it.
 *
 * AGENT_ORCHESTRATION is read at module load by supervisor.js, so the supervisor
 * is re-required per mode with the env set — otherwise every run would use
 * whichever mode happened to be configured when the process started.
 */
async function runOnce({ mode, question, ctx = {}, client, tools, hook, language }) {
  const startedAt = Date.now();

  let result;
  if (mode === 'single') {
    result = await runAgentStream({ question, ctx, client, tools, hook, language });
  } else {
    const previous = process.env.AGENT_ORCHESTRATION;
    process.env.AGENT_ORCHESTRATION = mode;
    jestSafeDecache();
    try {
      const { runSupervisor } = require('./supervisor');
      result = await runSupervisor({ question, ctx, client, tools, hook, language });
    } finally {
      if (previous === undefined) delete process.env.AGENT_ORCHESTRATION;
      else process.env.AGENT_ORCHESTRATION = previous;
      jestSafeDecache();
    }
  }

  const usage = result.usage || summarize(emptyUsage());
  return {
    mode,
    ms: Date.now() - startedAt,
    steps: result.steps,
    answerChars: (result.answer || '').length,
    workers: result.orchestration?.workers?.map((w) => w.worker) || [],
    calls: usage.calls,
    totalTokens: usage.totalTokens,
    tokensComplete: usage.complete, // false => the token figure is a floor
  };
}

// supervisor.js reads its config at require time, so the module cache has to be
// dropped between modes for the env change to take effect.
function jestSafeDecache() {
  try {
    delete require.cache[require.resolve('./supervisor')];
  } catch {
    /* not cached — nothing to do */
  }
}

/**
 * Run the same question through several modes and return a comparable report.
 *
 * @returns {Promise<{question, runs: [], comparison: object}>}
 */
async function compareModes({ question, modes = MODES, ...opts }) {
  const runs = [];
  for (const mode of modes) {
    try {
      runs.push(await runOnce({ mode, question, ...opts }));
    } catch (err) {
      runs.push({ mode, failed: true, error: err.message });
    }
  }
  return { question, runs, comparison: compare(runs) };
}

/** The headline numbers: what did orchestration actually buy, and cost? */
function compare(runs) {
  const by = (m) => runs.find((r) => r.mode === m && !r.failed);
  const single = by('single');
  const sequential = by('sequential');
  const parallel = by('parallel');

  const out = {};

  if (sequential && parallel) {
    out.parallelSpeedup = Number((sequential.ms / parallel.ms).toFixed(2));
    out.msSaved = sequential.ms - parallel.ms;
  }
  if (single && parallel) {
    // Usually > 1: orchestration is SLOWER than one agent for simple questions,
    // because routing and composition are extra round trips. Report it either way.
    out.orchestrationLatencyCost = Number((parallel.ms / single.ms).toFixed(2));
    out.extraCalls = parallel.calls - single.calls;
    if (single.totalTokens && parallel.totalTokens) {
      out.tokenCost = Number((parallel.totalTokens / single.totalTokens).toFixed(2));
    }
  }
  out.tokensAreComplete = runs.every((r) => r.failed || r.tokensComplete);
  return out;
}

/** A fixed-width table for a terminal. */
function formatReport(report) {
  const head = ['mode', 'ms', 'calls', 'tokens', 'steps', 'workers'];
  const rows = report.runs.map((r) =>
    r.failed
      ? [r.mode, 'FAILED', '-', '-', '-', r.error.slice(0, 30)]
      : [
          r.mode,
          String(r.ms),
          String(r.calls),
          `${r.totalTokens}${r.tokensComplete ? '' : '+'}`,
          String(r.steps),
          r.workers.join('+') || '-',
        ]
  );

  const widths = head.map((h, i) =>
    Math.max(h.length, ...rows.map((row) => String(row[i]).length))
  );
  const line = (cells) => cells.map((c, i) => String(c).padEnd(widths[i])).join('  ');

  const c = report.comparison;
  const notes = [];
  if (c.parallelSpeedup) {
    notes.push(`parallel vs sequential: ${c.parallelSpeedup}x faster (${c.msSaved}ms saved)`);
  }
  if (c.orchestrationLatencyCost) {
    notes.push(
      `orchestration vs single agent: ${c.orchestrationLatencyCost}x latency, ` +
        `+${c.extraCalls} model call(s)${c.tokenCost ? `, ${c.tokenCost}x tokens` : ''}`
    );
  }
  if (!c.tokensAreComplete) {
    notes.push('NOTE: a "+" means the provider withheld usage on some calls — tokens are a floor.');
  }

  return [
    `Q: ${report.question}`,
    line(head),
    line(widths.map((w) => '-'.repeat(w))),
    ...rows.map(line),
    '',
    ...notes,
  ].join('\n');
}

module.exports = { compareModes, runOnce, compare, formatReport, MODES };
