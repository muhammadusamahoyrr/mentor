// The clinical-safety contract. The instruction text lives alongside this file in
// systemPrompt.md — the prompt is authored and reviewed as Markdown prose, not
// buried in a string literal. This module loads it once and layers on the
// per-language wrapper. "Prove it, don't invent it."
const fs = require('fs');
const path = require('path');

const SYSTEM_PROMPT = fs.readFileSync(path.join(__dirname, 'systemPrompt.md'), 'utf8').trim();

// The confidence line and the safety rules live in one base prompt. When a
// language is requested, the safety rules are explicitly re-asserted so they are
// never silently dropped in translation.
function buildSystemPrompt({ language } = {}) {
  if (language && String(language).trim()) {
    const lang = String(language).trim();
    return `${SYSTEM_PROMPT}\n\nRespond entirely in ${lang}. Every rule above applies unchanged in ${lang}: ground and cite every claim, never diagnose or prescribe, refuse unsafe requests, and still output the CONFIDENCE line (keep the word "CONFIDENCE" and the level in English).`;
  }
  return SYSTEM_PROMPT;
}

module.exports = { SYSTEM_PROMPT, buildSystemPrompt };
