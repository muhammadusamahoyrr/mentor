const http = require('http');
const jwt = require('jsonwebtoken');
const prisma = require('../db');

// Tokens the real auth-service would mint, signed with the same shared secret.
const token = (user) =>
  jwt.sign(
    { id: user.id, name: user.name, email: `${user.id}@example.com`, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

const DOCTOR = { id: 'doctor-abc-111', name: 'Dr. House', role: 'doctor' };
const PATIENT = { id: 'patient-abc-222', name: 'Ann Patient', role: 'patient' };
const OUTSIDER = { id: 'outsider-abc-333', name: 'Nosy Parker', role: 'patient' };
const OTHER_DOCTOR = { id: 'doctor-abc-444', name: 'Dr. Other', role: 'doctor' };

const APPOINTMENT_ID = 'appt-0000000000000001';

/**
 * Stands in for appointment-service's GET /api/appointments/:id, reproducing the
 * contract notes-service depends on: participants get 200, everyone else 403,
 * unknown ids 404. Without this, notes-service cannot answer "may this caller
 * see this consultation's notes", because it holds no appointment data itself.
 */
function startAppointmentStub(port = 4999) {
  const server = http.createServer((req, res) => {
    const send = (code, body) => {
      res.writeHead(code, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
    };

    const match = req.url.match(/^\/api\/appointments\/([^/?]+)/);
    if (!match) return send(404, { message: 'Not found' });

    const raw = (req.headers.authorization || '').split(' ')[1];
    let caller;
    try {
      caller = jwt.verify(raw, process.env.JWT_SECRET);
    } catch {
      return send(401, { message: 'Authentication required' });
    }

    if (match[1] !== APPOINTMENT_ID) {
      return send(404, { message: 'Appointment not found' });
    }

    const uid = String(caller.id);
    if (uid !== DOCTOR.id && uid !== PATIENT.id) {
      return send(403, { message: 'Not authorized to view this appointment' });
    }

    send(200, {
      id: APPOINTMENT_ID,
      patientId: PATIENT.id,
      doctorId: DOCTOR.id,
      date: '2026-12-01',
      time: '10:00',
      status: 'confirmed',
      patient: { id: PATIENT.id, name: PATIENT.name },
      doctor: { id: DOCTOR.id, name: DOCTOR.name, specialization: 'Diagnostics' },
    });
  });

  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}

const resetDb = async () => {
  // Notes first: they hold the foreign key into Doctor.
  await prisma.note.deleteMany();
  await prisma.doctor.deleteMany();
};

module.exports = {
  token,
  DOCTOR,
  PATIENT,
  OUTSIDER,
  OTHER_DOCTOR,
  APPOINTMENT_ID,
  startAppointmentStub,
  resetDb,
  prisma,
};
