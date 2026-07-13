const request = require('supertest');
const app = require('../server');
const {
  token, DOCTOR, PATIENT, OUTSIDER, resetDb, prisma,
} = require('./helpers');

const docAuth = () => ({ Authorization: `Bearer ${token(DOCTOR)}` });
const patAuth = () => ({ Authorization: `Bearer ${token(PATIENT)}` });

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

// ── Authentication ────────────────────────────────────────────
describe('authentication', () => {
  it('rejects a request with no token (401)', async () => {
    const res = await request(app).get(`/api/notes?doctorId=${doctorId}`);
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/authentication required/i);
  });

  it('rejects a token signed with the wrong secret (401)', async () => {
    const jwt = require('jsonwebtoken');
    const forged = jwt.sign({ id: DOCTOR.id, role: 'doctor' }, 'wrong-secret');
    const res = await request(app)
      .get(`/api/notes?doctorId=${doctorId}`)
      .set('Authorization', `Bearer ${forged}`);
    expect(res.status).toBe(401);
  });

  it('rejects an expired token (401)', async () => {
    const jwt = require('jsonwebtoken');
    const stale = jwt.sign(
      { id: DOCTOR.id, role: 'doctor' },
      process.env.JWT_SECRET,
      { expiresIn: -10 }
    );
    const res = await request(app)
      .get(`/api/notes?doctorId=${doctorId}`)
      .set('Authorization', `Bearer ${stale}`);
    expect(res.status).toBe(401);
  });

  it('accepts the token from a cookie as well as a bearer header (200)', async () => {
    const res = await request(app)
      .get(`/api/notes?doctorId=${doctorId}`)
      .set('Cookie', [`token=${token(DOCTOR)}`]);
    expect(res.status).toBe(200);
  });
});

// ── Role-based authorization ──────────────────────────────────
describe('role-based authorization', () => {
  it('lets a doctor delete a note they authored (200)', async () => {
    const note = await prisma.note.create({
      data: { doctorId, title: 'x', content: 'y', authorId: DOCTOR.id, authorRole: 'doctor' },
    });
    const res = await request(app).delete(`/api/notes/${note.id}`).set(docAuth());
    expect(res.status).toBe(200);
  });

  it('forbids a patient from deleting a note, even one they wrote (403)', async () => {
    const note = await prisma.note.create({
      data: { doctorId, title: 'x', content: 'y', authorId: PATIENT.id, authorRole: 'patient' },
    });

    const res = await request(app).delete(`/api/notes/${note.id}`).set(patAuth());

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/requires the role doctor/i);
    // The record must survive the refused request.
    expect(await prisma.note.findUnique({ where: { id: note.id } })).not.toBeNull();
  });

  it('forbids a patient from registering a doctor (403)', async () => {
    const res = await request(app)
      .post('/api/doctors')
      .set(patAuth())
      .send({ name: 'Fake', email: 'fake@example.com' });
    expect(res.status).toBe(403);
  });

  it('lets a doctor register a doctor (201)', async () => {
    const res = await request(app)
      .post('/api/doctors')
      .set(docAuth())
      .send({ name: 'Dr. New', email: 'new@example.com', specialization: 'Cardio' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Dr. New');
  });
});

// ── CRUD ──────────────────────────────────────────────────────
describe('CRUD on /api/notes', () => {
  it('CREATE returns 201 and records the author from the JWT, not the body', async () => {
    const res = await request(app)
      .post('/api/notes')
      .set(docAuth())
      .send({ doctorId, title: 'BP reading', content: '120/80', authorId: 'spoofed-id' });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe('BP reading');
    expect(res.body.doctorId).toBe(doctorId);
    expect(res.body.authorId).toBe(DOCTOR.id); // not 'spoofed-id'
  });

  it('READ (list) returns the doctor’s notes (200)', async () => {
    await request(app).post('/api/notes').set(docAuth())
      .send({ doctorId, title: 'One', content: 'first' });

    const res = await request(app).get(`/api/notes?doctorId=${doctorId}`).set(docAuth());
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe('One');
  });

  it('READ (one) joins the related doctor in (200)', async () => {
    const created = await request(app).post('/api/notes').set(docAuth())
      .send({ doctorId, title: 'Joined', content: 'body' });

    const res = await request(app).get(`/api/notes/${created.body.id}`).set(docAuth());
    expect(res.status).toBe(200);
    expect(res.body.doctor).toMatchObject({ id: doctorId, name: DOCTOR.name });
  });

  it('UPDATE edits the note in place (200)', async () => {
    const created = await request(app).post('/api/notes').set(docAuth())
      .send({ doctorId, title: 'Before', content: 'old' });

    const res = await request(app).put(`/api/notes/${created.body.id}`).set(docAuth())
      .send({ title: 'After', content: 'new' });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('After');
    expect(res.body.id).toBe(created.body.id); // same record, not a new one
    expect(await prisma.note.count()).toBe(1);
  });

  it('DELETE removes the note (200) and it is then gone (404)', async () => {
    const created = await request(app).post('/api/notes').set(docAuth())
      .send({ doctorId, title: 'Doomed', content: 'bye' });

    expect((await request(app).delete(`/api/notes/${created.body.id}`).set(docAuth())).status).toBe(200);
    expect((await request(app).get(`/api/notes/${created.body.id}`).set(docAuth())).status).toBe(404);
  });
});

// ── Error paths ───────────────────────────────────────────────
describe('error paths', () => {
  it('400 when the body fails validation (empty title)', async () => {
    const res = await request(app).post('/api/notes').set(docAuth())
      .send({ doctorId, title: '', content: 'x' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
    expect(Array.isArray(res.body.details)).toBe(true);
  });

  it('400 when neither doctorId nor appointmentId is supplied', async () => {
    const res = await request(app).post('/api/notes').set(docAuth())
      .send({ title: 'Orphan', content: 'no parent' });
    expect(res.status).toBe(400);
  });

  it('404 when the note is filed against a doctor that does not exist', async () => {
    const res = await request(app).post('/api/notes').set(docAuth())
      .send({ doctorId: 999999, title: 'x', content: 'y' });
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/doctor not found/i);
  });

  it('404 when reading, updating or deleting a note that does not exist', async () => {
    expect((await request(app).get('/api/notes/999999').set(docAuth())).status).toBe(404);
    expect((await request(app).put('/api/notes/999999').set(docAuth()).send({ title: 'x' })).status).toBe(404);
    expect((await request(app).delete('/api/notes/999999').set(docAuth())).status).toBe(404);
  });

  it('400 when listing notes without a filter — never dump every record', async () => {
    const res = await request(app).get('/api/notes').set(docAuth());
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/i);
  });

  it('403 when a stranger reads a standalone note that is not theirs', async () => {
    const created = await request(app).post('/api/notes').set(docAuth())
      .send({ doctorId, title: 'Private', content: 'confidential' });

    const res = await request(app)
      .get(`/api/notes/${created.body.id}`)
      .set('Authorization', `Bearer ${token(OUTSIDER)}`);

    expect(res.status).toBe(403);
    expect(res.text).not.toContain('confidential');
  });
});
