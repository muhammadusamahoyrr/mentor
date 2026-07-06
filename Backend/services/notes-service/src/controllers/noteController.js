const prisma = require('../db');
const { AppError, asyncHandler } = require('../middleware/errorHandler');

// CREATE — POST /api/notes
exports.createNote = asyncHandler(async (req, res) => {
  const { doctorId, title, content } = req.body;

  // Enforce the relationship: a note must belong to an existing doctor.
  const doctor = await prisma.doctor.findUnique({ where: { id: doctorId } });
  if (!doctor) {
    throw new AppError('Doctor not found', 404);
  }

  const note = await prisma.note.create({ data: { doctorId, title, content } });
  res.status(201).json(note);
});

// READ (list) — GET /api/notes   (optional ?doctorId= filter)
exports.getNotes = asyncHandler(async (req, res) => {
  const where = {};
  if (req.query.doctorId) {
    where.doctorId = Number(req.query.doctorId);
  }

  const notes = await prisma.note.findMany({ where, orderBy: { createdAt: 'desc' } });
  res.json(notes);
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
  res.json(note);
});

// UPDATE — PUT /api/notes/:id
exports.updateNote = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);

  const existing = await prisma.note.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError('Note not found', 404);
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

  await prisma.note.delete({ where: { id } });
  res.json({ message: 'Note deleted' });
});
