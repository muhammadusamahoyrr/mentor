const request = require('supertest');
const app = require('../server');
const { token, DOCTOR, PATIENT, OTHER_DOCTOR, resetDb, prisma } = require('./helpers');

const docAuth = () => ({ Authorization: `Bearer ${token(DOCTOR)}` });
const patAuth = () => ({ Authorization: `Bearer ${token(PATIENT)}` });
const otherDocAuth = () => ({ Authorization: `Bearer ${token(OTHER_DOCTOR)}` });

let doctorId;

beforeEach(async () => {
  await resetDb();
  const doctor = await prisma.doctor.create({
    data: { externalId: DOCTOR.id, name: DOCTOR.name, email: 'house@example.com' },
  });
  doctorId = doctor.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

const createNote = (auth, body) =>
  request(app).post('/api/notes').set(auth).send({ doctorId, title: 'Summary', content: 'x', ...body });

describe('AI-drafted notes are marked unreviewed', () => {
  it('stores an AI-drafted note as unreviewed:true', async () => {
    const res = await createNote(docAuth(), { aiDrafted: true });
    expect(res.status).toBe(201);
    expect(res.body.unreviewed).toBe(true);
  });

  it('stores a human-typed note as unreviewed:false', async () => {
    const res = await createNote(docAuth(), {});
    expect(res.status).toBe(201);
    expect(res.body.unreviewed).toBe(false);
  });
});

describe('POST /api/notes/:id/confirm', () => {
  it('lets the owning doctor confirm an AI note (unreviewed -> false)', async () => {
    const { body: note } = await createNote(docAuth(), { aiDrafted: true });
    expect(note.unreviewed).toBe(true);

    const res = await request(app).post(`/api/notes/${note.id}/confirm`).set(docAuth());
    expect(res.status).toBe(200);
    expect(res.body.unreviewed).toBe(false);

    // and it's actually persisted
    const after = await request(app).get(`/api/notes/${note.id}`).set(docAuth());
    expect(after.body.unreviewed).toBe(false);
  });

  it('refuses a patient (403 — doctors only sign off clinical notes)', async () => {
    const { body: note } = await createNote(docAuth(), { aiDrafted: true });
    const res = await request(app).post(`/api/notes/${note.id}/confirm`).set(patAuth());
    expect(res.status).toBe(403);

    // the note is still unreviewed — a refused confirm must not flip the flag
    const after = await request(app).get(`/api/notes/${note.id}`).set(docAuth());
    expect(after.body.unreviewed).toBe(true);
  });

  it('refuses a doctor who cannot access the note (403)', async () => {
    const { body: note } = await createNote(docAuth(), { aiDrafted: true });
    const res = await request(app).post(`/api/notes/${note.id}/confirm`).set(otherDocAuth());
    expect(res.status).toBe(403);
  });

  it('404s confirming a note that does not exist', async () => {
    const res = await request(app).post('/api/notes/99999999/confirm').set(docAuth());
    expect(res.status).toBe(404);
  });
});
