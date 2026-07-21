#!/usr/bin/env node
// CLI harness for the agent (Phase 1 verification surface).
//
//   npm run ask -- "your question"
//
// Runs the ReAct loop, streams the tool-call log to the console via the hook,
// and prints the final answer plus the timestamped tool log.
//
// Always runs the skills IN-PROCESS, even when HEALTHCARE_MCP_URL is configured:
// there is no doctor JWT at a command line, and the MCP server (rightly) refuses
// a caller it cannot identify. The in-process set is also the only one with the
// local `read_file` skill, which is what this harness is for.
require('dotenv').config();
const { runAgent } = require('../src/agent/loop');
const gateway = require('../src/agent/tools/gateway');
const { resolveProvider } = require('../src/agent/providers/factory');
const { createToolLogger } = require('../src/hooks/toolLogger');

(async () => {
  const question = process.argv.slice(2).join(' ').trim();
  if (!question) {
    console.error('usage: npm run ask -- "your question"');
    process.exit(1);
  }
  // The loop runs on Claude or Gemini, so check the key for whichever provider
  // is actually selected rather than always demanding the Anthropic one.
  const provider = resolveProvider();
  const keyFor = {
    anthropic: 'ANTHROPIC_API_KEY',
    gemini: process.env.GEMINI_API_KEY ? 'GEMINI_API_KEY' : 'GOOGLE_API_KEY',
  };
  if (!process.env[keyFor[provider]]) {
    console.error(`${keyFor[provider]} is not set in .env — cannot run the loop on ${provider}.`);
    process.exit(1);
  }

  const { hook, entries } = createToolLogger({ sessionId: 'cli' });

  try {
    const { answer, steps, stopReason } = await runAgent({
      question,
      hook,
      tools: gateway.inProcess(),
    });
    console.log(`\n=== ANSWER (${steps} step(s), stop: ${stopReason}) ===\n${answer}`);
    console.log('\n=== TOOL LOG ===');
    console.table(entries);
  } catch (err) {
    console.error('\nAgent failed:', err.message);
    process.exit(1);
  }
})();
