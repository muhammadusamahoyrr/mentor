// read_file skill (Phase 1) — reads a local .txt/.pdf from the agent docs folder.
// read_patient_file is the file-service-backed variant that streams real patient
// documents with the caller's JWT; this local reader stays for the CLI harness
// and tests.
//
// Deliberately NOT exposed over MCP: it reads this host's own filesystem, so it
// is composed into agent-service's registry only (see ./registry.js).
const fs = require('fs/promises');
const path = require('path');
const injectionGuard = require('../../../../../shared/agent/security/injectionGuard');

const DOCS_DIR = path.resolve(
  process.env.AGENT_DOCS_DIR || path.join(__dirname, '..', '..', '..', 'docs')
);

const MAX_CHARS = 20000; // keep tool results within a sane token budget

const definition = {
  name: 'read_file',
  description:
    'Read the text of a local .txt or .pdf document by filename (from the agent docs folder). Use when the doctor references a report to read.',
  input_schema: {
    type: 'object',
    properties: {
      filename: { type: 'string', description: 'The document filename, e.g. "labs.pdf".' },
    },
    required: ['filename'],
  },
};

async function handler({ filename }) {
  // Never trust a caller-supplied filename on disk: strip any path so it cannot
  // escape the docs folder with "../" or an absolute path.
  const safe = path.basename(String(filename || ''));
  if (!safe) {
    throw new Error('A filename is required');
  }
  const ext = path.extname(safe).toLowerCase();
  if (ext !== '.txt' && ext !== '.pdf') {
    throw new Error(`Unsupported file type "${ext}" — only .txt and .pdf are allowed`);
  }

  const full = path.join(DOCS_DIR, safe);
  const buf = await fs.readFile(full);

  let text;
  if (ext === '.pdf') {
    const { extractPdfText } = require('../../../../../shared/agent/utils/pdfText');
    text = await extractPdfText(buf);
  } else {
    text = buf.toString('utf8');
  }

  const truncated = text.length > MAX_CHARS;
  const body = truncated ? text.slice(0, MAX_CHARS) : text;
  // Untrusted document content: scan for prompt-injection and neutralize it.
  const g = injectionGuard.guard(body);
  return {
    filename: safe,
    chars: text.length,
    truncated,
    injectionFlagged: g.injectionFlagged,
    text: g.text,
  };
}

module.exports = { definition, handler };
