#!/usr/bin/env node
// Serial-vs-parallel (and vs single-agent) latency and cost measurement.
//
//   npm run bench -- "your question"
//   npm run bench -- "your question" --modes=single,parallel
//
// Runs the SAME question through each mode and prints a comparison. Every run
// makes real model calls — orchestration costs several times a single agent —
// so this is a deliberate, occasional measurement, not something to loop on.
//
// Latency is measured here and is reliable. Tokens come from the provider and
// are a floor (a "+" in the table means some calls withheld usage).
require('dotenv').config();
const { compareModes, formatReport, MODES } = require('../src/agent/orchestration/benchmark');
const { createToolLogger } = require('../src/hooks/toolLogger');
const gateway = require('../src/agent/tools/gateway');
const { resolveProviderChain } = require('../src/agent/providers/factory');

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=')[1] : fallback;
};

(async () => {
  const question = process.argv.slice(2).filter((a) => !a.startsWith('--')).join(' ').trim();
  if (!question) {
    console.error('usage: npm run bench -- "your question" [--modes=single,sequential,parallel]');
    process.exit(1);
  }

  const modes = arg('modes', MODES.join(',')).split(',').map((m) => m.trim()).filter(Boolean);

  // The tools run in-process: this measures ORCHESTRATION, and a CLI has no
  // doctor JWT to authenticate to the MCP server with.
  const skills = gateway.inProcess();
  const { hook } = createToolLogger({ sessionId: 'bench' });

  console.log(`provider chain: ${resolveProviderChain().join(' -> ')}`);
  console.log(`modes: ${modes.join(', ')}\n`);

  const report = await compareModes({
    question,
    modes,
    ctx: {},
    tools: skills,
    hook,
  });

  console.log(formatReport(report));
  process.exit(0);
})().catch((err) => {
  console.error('Benchmark failed:', err.message);
  process.exit(1);
});
