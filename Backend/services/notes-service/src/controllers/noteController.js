const prisma = require('../db');
const { AppError, asyncHandler } = require('../middleware/errorHandler');
const { fetchAppointmentForUser } = require('../services/appointmentClient');

// Mirror the appointment's doctor into the local Doctor table so the
// Doctor -> Note foreign key still points at a real row. Keyed on externalId
// (the auth-service user id) rather than the autoincrement id.
const upsertDoctorFromAppointment = (appointment) => {
  const externalId = String(appointment.doctorId);
  const name = appointment.doctor?.name ?? 'Unknown doctor';
  const specialization = appointment.doctor?.specialization ?? null;

  return prisma.doctor.upsert({
    where: { externalId },
    update: { name, specialization },
    create: { externalId, name, specialization },
  });
};

// A note attached to a consultation is reachable by that consultation's
// participants — appointment-service is the authority on who those are.
// A standalone note is reachable by whoever wrote it, or by the doctor it is
// filed under. Being merely logged in is never enough for either.
const assertCanAccess = async (note, req) => {
  if (note.appointmentId) {
    await fetchAppointmentForUser(note.appointmentId, req.token);
    return;
  }

  const doctor =
    note.doctor ?? (await prisma.doctor.findUnique({ where: { id: note.doctorId } }));

  const isAuthor = Boolean(note.authorId) && note.authorId === req.user.id;
  const isOwningDoctor =
    Boolean(doctor?.externalId) && doctor.externalId === req.user.id;

  if (!isAuthor && !isOwningDoctor) {
    throw new AppError('Not authorized to access this note', 403);
  }
};

// CREATE — POST /api/notes
exports.createNote = asyncHandler(async (req, res) => {
  const { doctorId, appointmentId, title, content } = req.body;
  const author = {
    authorId: req.user.id,
    authorName: req.user.name ?? null,
    authorRole: req.user.role ?? null,
  };

  // Consultation note: derive the doctor from the appointment, and only once
  // appointment-service has confirmed the caller is on it.
  if (appointmentId) {
    const appointment = await fetchAppointmentForUser(appointmentId, req.token);
    const doctor = await upsertDoctorFromAppointment(appointment);

    const note = await prisma.note.create({
      data: { doctorId: doctor.id, appointmentId, title, content, ...author },
    });
    return res.status(201).json(note);
  }

  // Standalone note: enforce the relationship against an existing doctor.
  const doctor = await prisma.doctor.findUnique({ where: { id: doctorId } });
  if (!doctor) {
    throw new AppError('Doctor not found', 404);
  }

  const note = await prisma.note.create({
    data: { doctorId, title, content, ...author },
  });
  res.status(201).json(note);
});

// READ (list) — GET /api/notes?appointmentId=  |  GET /api/notes?doctorId=
exports.getNotes = asyncHandler(async (req, res) => {
  const { appointmentId, doctorId } = req.query;

  if (appointmentId) {
    await fetchAppointmentForUser(appointmentId, req.token);

    const notes = await prisma.note.findMany({
      where: { appointmentId },
      orderBy: { createdAt: 'desc' },
    });
    return res.json(notes);
  }

  if (doctorId) {
    const id = Number(doctorId);
    const doctor = await prisma.doctor.findUnique({ where: { id } });
    if (!doctor) {
      throw new AppError('Doctor not found', 404);
    }

    // The doctor sees everything filed under them; anyone else sees only what
    // they wrote themselves. Consultation notes are excluded entirely — they
    // have to go through the appointmentId path so the participant check
    // can't be sidestepped.
    const isOwningDoctor =
      Boolean(doctor.externalId) && doctor.externalId === req.user.id;

    const notes = await prisma.note.findMany({
      where: {
        doctorId: id,
        appointmentId: null,
        ...(isOwningDoctor ? {} : { authorId: req.user.id }),
      },
      orderBy: { createdAt: 'desc' },
    });
    return res.json(notes);
  }

  // Listing every note in the service is never a safe default.
  throw new AppError('Either appointmentId or doctorId is required', 400);
});

// READ (one) — GET /api/notes/:id   (author joined in via `include`)
exports.getNoteById = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);

  const note = await prisma.note.findUnique({
    where: { id },
    include: { doctor: true }, // Prisma's join — pulls in the related Doctor
  });

  if (!note) {
    throw new AppError('Note not found', 404);
  }
  await assertCanAccess(note, req);

  res.json(note);
});

// UPDATE — PUT /api/notes/:id
exports.updateNote = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);

  const existing = await prisma.note.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError('Note not found', 404);
  }
  await assertCanAccess(existing, req);

  // Being on the appointment is enough to read a note, not to rewrite someone
  // else's clinical record.
  if (existing.appointmentId && existing.authorId !== req.user.id) {
    throw new AppError('Only the author can edit this note', 403);
  }

  const note = await prisma.note.update({ where: { id }, data: req.body });
  res.json(note);
});

// DELETE — DELETE /api/notes/:id
exports.deleteNote = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);

  const existing = await prisma.note.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError('Note not found', 404);
  }
  await assertCanAccess(existing, req);

  if (existing.appointmentId && existing.authorId !== req.user.id) {
    throw new AppError('Only the author can delete this note', 403);
  }

  await prisma.note.delete({ where: { id } });
  res.json({ message: 'Note deleted' });
});
