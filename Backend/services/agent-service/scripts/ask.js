#!/usr/bin/env node
// CLI harness for the agent (Phase 1 verification surface).
//
//   npm run ask -- "your question"
//
// Runs the ReAct loop, streams the tool-call log to the console via the hook,
// and prints the final answer plus the timestamped tool log.
require('dotenv').config();
const { runAgent } = require('../src/agent/loop');
const { createToolLogger } = require('../src/hooks/toolLogger');

(async () => {
  const question = process.argv.slice(2).join(' ').trim();
  if (!question) {
    console.error('usage: npm run ask -- "your question"');
    process.exit(1);
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY is not set in .env — cannot run the loop.');
    process.exit(1);
  }

  const { hook, entries } = createToolLogger({ sessionId: 'cli' });

  try {
    const { answer, steps, stopReason } = await runAgent({ question, hook });
    console.log(`\n=== ANSWER (${steps} step(s), stop: ${stopReason}) ===\n${answer}`);
    console.log('\n=== TOOL LOG ===');
    console.table(entries);
  } catch (err) {
    console.error('\nAgent failed:', err.message);
    process.exit(1);
  }
})();
