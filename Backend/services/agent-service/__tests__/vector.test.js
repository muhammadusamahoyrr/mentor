const { chunk } = require('../src/vector/chunk');
const embed = require('../src/vector/embed');
const chroma = require('../src/vector/chroma');
const { makeFakeChroma } = require('./fakeChroma');

describe('chunk', () => {
  it('returns [] for empty text', () => {
    expect(chunk('')).toEqual([]);
    expect(chunk('   \n  ')).toEqual([]);
  });

  it('splits long text into overlapping windows', () => {
    const text = 'abcdefghij'.repeat(400); // 4000 chars
    const parts = chunk(text, { size: 1500, overlap: 200 });
    expect(parts.length).toBeGreaterThan(1);
    expect(parts[0]).toHaveLength(1500);
    // overlap: end of chunk 0 reappears at start of chunk 1
    expect(parts[1].startsWith(parts[0].slice(1500 - 200))).toBe(true);
  });

  it('rejects overlap >= size', () => {
    expect(() => chunk('abc', { size: 100, overlap: 100 })).toThrow(/overlap/);
  });
});

describe('embed', () => {
  it('fails closed without VOYAGE_API_KEY', async () => {
    await expect(embed.embed(['hello'])).rejects.toThrow(/VOYAGE_API_KEY/);
  });
});

describe('vector/chroma — the PHI hard guard', () => {
  afterEach(() => chroma.setClient(null));

  it('refuses (throws) to query without a patientId scope — fail closed', async () => {
    chroma.setClient(makeFakeChroma());
    await expect(
      chroma.query('clinical_docs', { queryEmbedding: [0.1], filter: {}, k: 5 })
    ).rejects.toThrow(chroma.GUARD_MESSAGE);
    await expect(
      chroma.query('clinical_docs', { queryEmbedding: [0.1], filter: { patientId: '' }, k: 5 })
    ).rejects.toThrow(chroma.GUARD_MESSAGE);
    await expect(
      chroma.query('clinical_docs', { queryEmbedding: [0.1], filter: { doctorId: 'd1' }, k: 5 })
    ).rejects.toThrow(chroma.GUARD_MESSAGE);
  });

  it('NEVER returns another patient’s chunks (cross-patient negative test)', async () => {
    const fake = makeFakeChroma();
    chroma.setClient(fake);
    await chroma.upsert('clinical_docs', [
      { id: 'a0', text: 'patient A: BP 150/95', embedding: [0.1], metadata: { patientId: 'A', doctorId: 'd1' } },
      { id: 'b0', text: 'patient B: secret', embedding: [0.1], metadata: { patientId: 'B', doctorId: 'd1' } },
    ]);

    const hits = await chroma.query('clinical_docs', {
      queryEmbedding: [0.1],
      filter: { patientId: 'A', doctorId: 'd1' },
      k: 5,
    });

    expect(hits).toHaveLength(1);
    expect(hits[0].text).toContain('patient A');
    expect(hits.some((h) => h.text.includes('secret'))).toBe(false);
    // and the filter really carried the patientId scope
    expect(JSON.stringify(fake.lastWhere())).toContain('patientId');
  });
});
