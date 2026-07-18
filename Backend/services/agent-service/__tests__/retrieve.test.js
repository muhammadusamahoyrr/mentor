// retrieve_docs skill: embeddings mocked, Chroma faked. Proves the skill's own
// PHI guard and that it scopes retrieval by both patientId and the caller doctor.
jest.mock('../src/vector/embed', () => ({
  embed: jest.fn(async (texts) => texts.map(() => [0.1, 0.2, 0.3])),
}));

const chroma = require('../src/vector/chroma');
const retrieveDocs = require('../src/agent/tools/retrieveDocs');
const { makeFakeChroma } = require('./fakeChroma');

describe('retrieve_docs skill', () => {
  let fake;
  beforeEach(async () => {
    fake = makeFakeChroma();
    chroma.setClient(fake);
    await chroma.upsert('clinical_docs', [
      {
        id: 'a0',
        text: 'Patient A latest labs: cholesterol high.',
        embedding: [0.1, 0.2, 0.3],
        metadata: { patientId: 'A', doctorId: 'doc1', sourceType: 'file', sourceId: 'f1', docName: 'labs.pdf' },
      },
      {
        id: 'b0',
        text: 'Patient B notes — must not leak.',
        embedding: [0.1, 0.2, 0.3],
        metadata: { patientId: 'B', doctorId: 'doc1', sourceType: 'file', sourceId: 'f2', docName: 'b.pdf' },
      },
    ]);
  });
  afterEach(() => chroma.setClient(null));

  it('fails closed without a patientId', async () => {
    await expect(retrieveDocs.handler({ query: 'labs' }, { userId: 'doc1' })).rejects.toThrow(
      /patientId/
    );
  });

  it('fails closed without an authenticated caller', async () => {
    await expect(retrieveDocs.handler({ patientId: 'A', query: 'labs' }, {})).rejects.toThrow(
      /authenticated/
    );
  });

  it('returns only the named patient’s passages, with source citations', async () => {
    const out = await retrieveDocs.handler(
      { patientId: 'A', query: 'cholesterol' },
      { userId: 'doc1', token: 't' }
    );
    expect(out.count).toBe(1);
    expect(out.passages[0]).toMatchObject({ source: 'labs.pdf', sourceType: 'file', sourceId: 'f1' });
    expect(out.passages.some((p) => p.text.includes('must not leak'))).toBe(false);

    // scoped by BOTH patientId and the calling doctor
    const where = JSON.stringify(fake.lastWhere());
    expect(where).toContain('patientId');
    expect(where).toContain('doctorId');
  });
});
