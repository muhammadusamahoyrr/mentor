#!/usr/bin/env node
// Measure the supervisor's routing accuracy against the eval set.
//
//   npm run eval:routing
//
// This makes ONE real model call per case (15 by default), so it costs real
// quota — on a rate-limited free tier, use --delay to space the calls out.
//
// It REPORTS the number; it never asserts one. Routing quality is a property of
// the model, so turning it into a pass/fail gate would just break CI whenever a
// provider changed behaviour.
require('dotenv').config();
const { route } = require('../src/agent/orchestration/supervisor');
const { CASES, score } = require('../src/agent/orchestration/routingEval');
const { createClient, resolveProviderChain } = require('../src/agent/providers/factory');

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=')[1] : fallback;
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const delay = Number(arg('delay', 0));
  const client = createClient();

  console.log(`Routing eval — ${CASES.length} cases`);
  console.log(`provider chain: ${resolveProviderChain().join(' -> ')}`);
  if (delay) console.log(`pacing: ${delay}ms between calls`);
  console.log('');

  const results = [];
  for (const [i, testCase] of CASES.entries()) {
    process.stdout.write(`  ${String(i + 1).padStart(2)}/${CASES.length} `);
    try {
      const plan = await route({ question: testCase.question, history: [], client });
      const actual = plan.ok ? plan.assignments.map((a) => a.worker) : [];
      results.push({ testCase, actual, error: plan.ok ? null : plan.error });
      console.log(plan.ok ? actual.join('+') || '(none)' : `unparseable: ${plan.error}`);
    } catch (err) {
      results.push({ testCase, actual: [], error: err.message });
      console.log(`FAILED: ${err.message}`);
    }
    if (delay) await sleep(delay);
  }

  const report = score(results);
  console.log('\n─────────────────────────────────────────');
  console.log(`Routing accuracy: ${report.correct}/${report.total} = ${(report.accuracy * 100).toFixed(1)}%`);

  if (report.misses.length) {
    console.log('\nMisroutes:');
    for (const m of report.misses) {
      console.log(`  Q: ${m.question}`);
      console.log(`     expected ${JSON.stringify(m.expected)}, got ${JSON.stringify(m.actual)}`);
    }
  }
  console.log('\n(Reported, not asserted — routing quality is the model\'s, not the code\'s.)');
  process.exit(0);
})().catch((err) => {
  console.error('Routing eval failed:', err.message);
  process.exit(1);
});
