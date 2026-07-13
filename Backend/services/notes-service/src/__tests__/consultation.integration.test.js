const request = require('supertest');
const app = require('../server');
const {
  token, DOCTOR, PATIENT, OUTSIDER, APPOINTMENT_ID,
  startAppointmentStub, resetDb, prisma,
} = require('./helpers');

/**
 * Integration test for a consultation note: the real path the video-call page
 * drives, exercised end to end across a service boundary.
 *
 * Unlike the unit tests, nothing here is faked inside notes-service. A real HTTP
 * appointment-service stands on :4999, notes-service really calls it over the
 * wire to decide who is allowed in, and Prisma really writes to SQLite. The only
 * substitution is that the appointment lives in the stub rather than in Mongo.
 */
describe('consultation notes (integration, across services)', () => {
  let stub;

  beforeAll(async () => {
    stub = await startAppointmentStub(4999);
  });

  afterAll(async () => {
    await new Promise((resolve) => stub.close(resolve));
    await prisma.$disconnect();
  });

  beforeEach(resetDb);

  const as = (user) => ({ Authorization: `Bearer ${token(user)}` });

  it('runs the happy path: doctor writes a note, patient reads it, doctor revises it, doctor deletes it', async () => {
    // 1. CREATE — the doctor files a note against the consultation. No doctorId
    //    is sent: notes-service derives it from the appointment and upserts a
    //    local Doctor row keyed on the auth-service user id.
    const created = await request(app)
      .post('/api/notes')
      .set(as(DOCTOR))
      .send({
        appointmentId: APPOINTMENT_ID,
        title: 'Consultation',
        content: 'BP 130/85. Continue statins.',
      });

    expect(created.status).toBe(201);
    expect(created.body.appointmentId).toBe(APPOINTMENT_ID);
    expect(created.body.authorId).toBe(DOCTOR.id);
    expect(created.body.authorRole).toBe('doctor');
    const noteId = created.body.id;

    // The one-to-many relation now points at a real platform user.
    const doctorRow = await prisma.doctor.findUnique({ where: { externalId: DOCTOR.id } });
    expect(doctorRow).not.toBeNull();
    expect(created.body.doctorId).toBe(doctorRow.id);

    // 2. READ — the patient is on this appointment, so they may read it.
    const patientView = await request(app)
      .get(`/api/notes?appointmentId=${APPOINTMENT_ID}`)
      .set(as(PATIENT));

    expect(patientView.status).toBe(200);
    expect(patientView.body).toHaveLength(1);
    expect(patientView.body[0].content).toBe('BP 130/85. Continue statins.');

    // 3. UPDATE — the author revises the note in place rather than adding another.
    const updated = await request(app)
      .put(`/api/notes/${noteId}`)
      .set(as(DOCTOR))
      .send({ content: 'BP 130/85. Continue statins. Review in 4 weeks.' });

    expect(updated.status).toBe(200);
    expect(updated.body.content).toMatch(/Review in 4 weeks/);
    expect(await prisma.note.count()).toBe(1);

    // 4. DELETE — the doctor removes it, and it is really gone.
    const deleted = await request(app).delete(`/api/notes/${noteId}`).set(as(DOCTOR));
    expect(deleted.status).toBe(200);
    expect(await prisma.note.count()).toBe(0);
  });

  it('refuses a user who is not on the appointment, at every verb', async () => {
    const created = await request(app)
      .post('/api/notes')
      .set(as(DOCTOR))
      .send({ appointmentId: APPOINTMENT_ID, title: 'Private', content: 'confidential finding' });

    const noteId = created.body.id;
    const outsider = as(OUTSIDER);

    // appointment-service tells notes-service this caller is not a participant.
    expect((await request(app).get(`/api/notes?appointmentId=${APPOINTMENT_ID}`).set(outsider)).status).toBe(403);
    expect((await request(app).get(`/api/notes/${noteId}`).set(outsider)).status).toBe(403);
    expect((await request(app).put(`/api/notes/${noteId}`).set(outsider).send({ content: 'tampered' })).status).toBe(403);

    const read = await request(app).get(`/api/notes/${noteId}`).set(outsider);
    expect(read.text).not.toContain('confidential finding');

    // And nothing they tried actually changed the record.
    const stored = await prisma.note.findUnique({ where: { id: noteId } });
    expect(stored.content).toBe('confidential finding');
  });

  it('lets a participant read a note but not rewrite someone else’s', async () => {
    const created = await request(app)
      .post('/api/notes')
      .set(as(DOCTOR))
      .send({ appointmentId: APPOINTMENT_ID, title: 'Doctor note', content: 'original' });

    // The patient is a participant, so reading is fine...
    expect((await request(app).get(`/api/notes/${created.body.id}`).set(as(PATIENT))).status).toBe(200);

    // ...but being on the appointment is not licence to edit the doctor's record.
    const attempt = await request(app)
      .put(`/api/notes/${created.body.id}`)
      .set(as(PATIENT))
      .send({ content: 'rewritten by the patient' });

    expect(attempt.status).toBe(403);
    const stored = await prisma.note.findUnique({ where: { id: created.body.id } });
    expect(stored.content).toBe('original');
  });

  it('404s for an appointment that does not exist', async () => {
    const res = await request(app)
      .get('/api/notes?appointmentId=appt-does-not-exist')
      .set(as(DOCTOR));
    expect(res.status).toBe(404);
  });

  it('keeps consultation notes out of the doctorId listing and the /api/doctors join', async () => {
    await request(app).post('/api/notes').set(as(DOCTOR))
      .send({ appointmentId: APPOINTMENT_ID, title: 'Clinical', content: 'sensitive' });

    const doctorRow = await prisma.doctor.findUnique({ where: { externalId: DOCTOR.id } });

    // The plain CRUD listing must not become a side door into clinical records.
    const byDoctor = await request(app)
      .get(`/api/notes?doctorId=${doctorRow.id}`)
      .set(as(DOCTOR));
    expect(byDoctor.body.filter((n) => n.appointmentId)).toHaveLength(0);

    const doctors = await request(app).get('/api/doctors').set(as(DOCTOR));
    const leaked = doctors.body.flatMap((d) => d.notes || []).filter((n) => n.appointmentId);
    expect(leaked).toHaveLength(0);
  });
});
