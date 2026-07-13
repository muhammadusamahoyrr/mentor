const prisma = require('../db');
const { AppError, asyncHandler } = require('../middleware/errorHandler');

// CREATE a doctor — POST /api/doctors  (the parent, so notes can be attached)
//
// externalId (the auth-service user id) is required and is what the row is
// keyed on. Creating a row without one used to leave it in a second, parallel
// keyspace: the note flow upserts on externalId (noteController's
// upsertDoctorFromAppointment) and never sets an email, this endpoint set an
// email and never an externalId, and Postgres permits many NULLs in a unique
// column — so one doctor could end up holding two rows, with the notes on the
// row whose access check (externalId === req.user.id) can never pass.
// Upserting on the same key both services already agree on makes that
// impossible rather than merely unlikely.
exports.createDoctor = asyncHandler(async (req, res) => {
  const { externalId, name, email, specialization } = req.body;

  if (!externalId || !name || !email) {
    throw new AppError('externalId, name and email are required', 400);
  }

  const doctor = await prisma.doctor.upsert({
    where: { externalId: String(externalId) },
    update: { name, email, specialization },
    create: { externalId: String(externalId), name, email, specialization },
  });
  res.status(201).json(doctor);
});

// LIST doctors with their notes — GET /api/doctors  (relationship, the other direction)
exports.getDoctors = asyncHandler(async (req, res) => {
  const doctors = await prisma.doctor.findMany({
    // Each doctor comes back with their notes nested. Consultation notes are
    // excluded: they can only be read via /api/notes?appointmentId=, where the
    // caller is checked against the appointment's participants.
    include: { notes: { where: { appointmentId: null } } },
    orderBy: { id: 'asc' },
  });
  res.json(doctors);
});
