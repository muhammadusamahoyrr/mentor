// list_patient_files skill — lists the medical documents patients have shared
// with this doctor (file-service scopes GET /api/files/my to the caller). Use it
// to discover which document to read before calling read_patient_file.
const { requireToken, authHeaders } = require('./serviceClient');

const BASE = process.env.FILE_SERVICE_URL || 'http://localhost:3005';

const definition = {
  name: 'list_patient_files',
  description:
    'List the medical documents patients have shared with you (the doctor). Returns [{id, fileName, patientId, uploadedAt}]. Use to find a document before reading it.',
  input_schema: { type: 'object', properties: {}, required: [] },
};

async function handler(_input, ctx) {
  const token = requireToken(ctx);

  let res;
  try {
    res = await fetch(`${BASE}/api/files/my`, { headers: authHeaders(token) });
  } catch (err) {
    throw new Error(`Could not reach file-service: ${err.message}`, { cause: err });
  }
  if (res.status === 401 || res.status === 403) throw new Error('Not authorized to list files');
  if (!res.ok) throw new Error(`file-service returned ${res.status}`);

  const files = await res.json();
  return {
    count: Array.isArray(files) ? files.length : 0,
    files: (Array.isArray(files) ? files : []).map((f) => ({
      id: String(f._id || f.id),
      fileName: f.fileName,
      patientId: String(f.patientId),
      uploadedAt: f.uploadedAt,
    })),
  };
}

module.exports = { definition, handler };
