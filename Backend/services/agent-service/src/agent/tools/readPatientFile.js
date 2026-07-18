// read_patient_file skill — streams a real medical document from file-service by
// id and extracts its text. Binary-safe: reads the bytes as an ArrayBuffer (never
// response.text(), which would corrupt a PDF by decoding it as UTF-8).
const { requireToken, authHeaders } = require('./_serviceUtil');
const injectionGuard = require('../../security/injectionGuard');

const BASE = process.env.FILE_SERVICE_URL || 'http://localhost:3005';
const MAX_CHARS = 20000;

const definition = {
  name: 'read_patient_file',
  description:
    'Read the text of a medical document (.txt or .pdf) shared with you, by its file id. Returns the extracted text. Find the id first with list_patient_files.',
  input_schema: {
    type: 'object',
    properties: { fileId: { type: 'string', description: 'The file id from list_patient_files.' } },
    required: ['fileId'],
  },
};

async function handler({ fileId }, ctx) {
  const token = requireToken(ctx);

  let res;
  try {
    res = await fetch(`${BASE}/api/files/${encodeURIComponent(fileId)}/content`, {
      headers: authHeaders(token),
    });
  } catch (err) {
    throw new Error(`Could not reach file-service: ${err.message}`, { cause: err });
  }

  if (res.status === 401 || res.status === 403) {
    throw new Error('Access denied — this file is not shared with you');
  }
  if (res.status === 404) throw new Error('File not found');
  if (res.status === 410) throw new Error('This record predates real uploads and has no stored file');
  if (!res.ok) throw new Error(`file-service returned ${res.status}`);

  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  const buf = Buffer.from(await res.arrayBuffer());

  let text;
  if (contentType.includes('pdf')) {
    const { extractPdfText } = require('../../utils/pdfText');
    text = await extractPdfText(buf);
  } else if (contentType.includes('text/') || contentType.includes('json')) {
    text = buf.toString('utf8');
  } else {
    return {
      fileId,
      contentType,
      bytes: buf.length,
      text: null,
      note: 'This document is not a text/PDF format, so no text could be extracted.',
    };
  }

  const truncated = text.length > MAX_CHARS;
  const body = truncated ? text.slice(0, MAX_CHARS) : text;
  const g = injectionGuard.guard(body); // neutralize any prompt-injection in the document
  return {
    fileId,
    contentType,
    chars: text.length,
    truncated,
    injectionFlagged: g.injectionFlagged,
    text: g.text,
  };
}

module.exports = { definition, handler };
