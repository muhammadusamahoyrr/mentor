// PDF text extraction.
//
// We use `unpdf` (maintained pdf.js distribution) rather than pdf-parse: the
// latter bundles a 2018 pdf.js build that throws "bad XRef entry" on Node 24 for
// perfectly valid PDFs, which would silently break every PDF the agent reads.
// unpdf is ESM-only, so it is loaded via dynamic import from this CommonJS file.
async function extractPdfText(buffer) {
  const { extractText, getDocumentProxy } = await import('unpdf');
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });
  return text;
}

module.exports = { extractPdfText };
