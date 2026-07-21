#!/usr/bin/env node
// Backfill the vector store (Phase 4 / Option D).
//
//   node scripts/ingest.js --token=<a doctor JWT>
//   AGENT_INGEST_TOKEN=<jwt> node scripts/ingest.js
//
// Deliberately reuses the SAME skills the agent uses at query time
// (list_patient_files + read_patient_file), so ingestion can only index the
// documents that doctor is actually allowed to read. Each chunk is tagged with
// {patientId, doctorId}, which is exactly the scope retrieve_docs filters on —
// so the store never contains a chunk a doctor could retrieve but not open.
require('dotenv').config();
const jwt = require('jsonwebtoken');
const listPatientFiles = require('../../../shared/agent/tools/listPatientFiles');
const readPatientFile = require('../../../shared/agent/tools/readPatientFile');
const { chunk } = require('../../../shared/agent/vector/chunk');
const embed = require('../../../shared/agent/vector/embed');
const chroma = require('../../../shared/agent/vector/chroma');

(async () => {
  const arg = process.argv.find((a) => a.startsWith('--token='));
  const token = (arg ? arg.split('=')[1] : '') || process.env.AGENT_INGEST_TOKEN;
  if (!token) {
    console.error('Provide a doctor JWT via --token=<jwt> or AGENT_INGEST_TOKEN.');
    process.exit(1);
  }

  const decoded = jwt.decode(token) || {};
  const doctorId = String(decoded.id ?? decoded.userId ?? '');
  if (!doctorId) {
    console.error('Could not read a user id from that token.');
    process.exit(1);
  }
  const ctx = { token, userId: doctorId };

  const { files } = await listPatientFiles.handler({}, ctx);
  console.log(`Found ${files.length} shared document(s) to index for doctor ${doctorId}.`);

  const items = [];
  for (const f of files) {
    try {
      const doc = await readPatientFile.handler({ fileId: f.id }, ctx);
      if (!doc.text) {
        console.log(`  skip ${f.fileName} (no extractable text)`);
        continue;
      }
      const parts = chunk(doc.text);
      const embeddings = await embed.embed(parts);
      parts.forEach((text, i) =>
        items.push({
          id: `${f.id}:${i}`,
          text,
          embedding: embeddings[i],
          metadata: {
            patientId: f.patientId,
            doctorId,
            sourceType: 'file',
            sourceId: f.id,
            docName: f.fileName,
          },
        })
      );
      console.log(`  indexed ${f.fileName} (${parts.length} chunk(s))`);
    } catch (err) {
      console.warn(`  failed ${f.fileName}: ${err.message}`);
    }
  }

  await chroma.upsert('clinical_docs', items);
  console.log(`Upserted ${items.length} chunk(s) into clinical_docs.`);
  process.exit(0);
})().catch((err) => {
  console.error('Ingest failed:', err.message);
  process.exit(1);
});
