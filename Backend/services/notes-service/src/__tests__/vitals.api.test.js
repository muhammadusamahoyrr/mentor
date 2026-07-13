const request = require('supertest');
const app = require('../server');
const { token, DOCTOR, PATIENT, OUTSIDER, prisma } = require('./helpers');

const asPatient = () => ({ Authorization: `Bearer ${token(PATIENT)}` });
const asDoctor = () => ({ Authorization: `Bearer ${token(DOCTOR)}` });
const asOther = () => ({ Authorization: `Bearer ${token(OUTSIDER)}` });

beforeEach(async () => {
  await prisma.vital.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('vitals — authentication and role', () => {
  it('401 without a token', async () => {
    expect((await request(app).get('/api/vitals')).status).toBe(401);
  });

  it('403 when a doctor tries to record a vital — vitals are self-reported', async () => {
    const res = await request(app).post('/api/vitals').set(asDoctor()).send({ heartRate: 70 });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/requires the role patient/i);
  });

  it('201 when a patient records their own', async () => {
    const res = await request(app).post('/api/vitals').set(asPatient()).send({ heartRate: 72 });
    expect(res.status).toBe(201);
    expect(res.body.heartRate).toBe(72);
  });
});

describe('vitals — the patient only ever sees their own', () => {
  it('scopes reads to the caller, and ignores any patientId in the body', async () => {
    // The patient records a reading, spoofing someone else's id in the payload.
    const created = await request(app)
      .post('/api/vitals')
      .set(asPatient())
      .send({ heartRate: 66, patientId: OUTSIDER.id });

    expect(created.status).toBe(201);
    // The id comes from the JWT, never from the body.
    expect(created.body.patientId).toBe(PATIENT.id);

    // The other user sees nothing — there is no way to ask for someone else's.
    const otherView = await request(app).get('/api/vitals').set(asOther());
    expect(otherView.status).toBe(200);
    expect(otherView.body).toHaveLength(0);

    const ownView = await request(app).get('/api/vitals').set(asPatient());
    expect(ownView.body).toHaveLength(1);
    expect(ownView.body[0].heartRate).toBe(66);
  });

  it('403 when deleting a reading that belongs to someone else', async () => {
    const mine = await request(app).post('/api/vitals').set(asPatient()).send({ weightKg: 70 });

    const res = await request(app).delete(`/api/vitals/${mine.body.id}`).set(asOther());
    expect(res.status).toBe(403);

    // And it survives the attempt.
    expect(await prisma.vital.count()).toBe(1);
  });

  it('deletes your own reading', async () => {
    const mine = await request(app).post('/api/vitals').set(asPatient()).send({ weightKg: 70 });
    expect((await request(app).delete(`/api/vitals/${mine.body.id}`).set(asPatient())).status).toBe(200);
    expect(await prisma.vital.count()).toBe(0);
  });
});

describe('vitals — validation', () => {
  it('400 when the reading is empty — a blank form is not a measurement', async () => {
    const res = await request(app).post('/api/vitals').set(asPatient()).send({});
    expect(res.status).toBe(400);
    expect(res.body.details.join(' ')).toMatch(/at least one/i);
  });

  it('400 when only half a blood pressure is given', async () => {
    const res = await request(app).post('/api/vitals').set(asPatient()).send({ systolic: 120 });
    expect(res.status).toBe(400);
    expect(res.body.details.join(' ')).toMatch(/both systolic and diastolic/i);
  });

  it('400 when systolic is not above diastolic', async () => {
    const res = await request(app)
      .post('/api/vitals')
      .set(asPatient())
      .send({ systolic: 70, diastolic: 120 });
    expect(res.status).toBe(400);
  });

  it('400 on a physiologically impossible value (a typo, or lbs entered as kg)', async () => {
    expect((await request(app).post('/api/vitals').set(asPatient()).send({ heartRate: 900 })).status).toBe(400);
    expect((await request(app).post('/api/vitals').set(asPatient()).send({ weightKg: 900 })).status).toBe(400);
  });

  it('accepts a partial reading — weight alone is a legitimate entry', async () => {
    const res = await request(app).post('/api/vitals').set(asPatient()).send({ weightKg: 73.4 });
    expect(res.status).toBe(201);
    expect(res.body.weightKg).toBe(73.4);
    expect(res.body.heartRate).toBeNull(); // absent, not zero
  });
});

describe('vitals — ordering', () => {
  it('returns readings oldest-first, so a chart reads left to right', async () => {
    await request(app).post('/api/vitals').set(asPatient())
      .send({ heartRate: 70, recordedAt: '2026-01-03T09:00:00.000Z' });
    await request(app).post('/api/vitals').set(asPatient())
      .send({ heartRate: 60, recordedAt: '2026-01-01T09:00:00.000Z' });
    await request(app).post('/api/vitals').set(asPatient())
      .send({ heartRate: 65, recordedAt: '2026-01-02T09:00:00.000Z' });

    const res = await request(app).get('/api/vitals').set(asPatient());
    expect(res.body.map((v) => v.heartRate)).toEqual([60, 65, 70]);
  });
});
