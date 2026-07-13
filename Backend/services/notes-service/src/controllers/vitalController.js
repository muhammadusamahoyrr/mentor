const prisma = require('../db');
const { AppError, asyncHandler } = require('../middleware/errorHandler');

// CREATE — POST /api/vitals
exports.createVital = asyncHandler(async (req, res) => {
  const { recordedAt, heartRate, systolic, diastolic, weightKg } = req.body;

  const vital = await prisma.vital.create({
    data: {
      // Never from the body: a patient records readings about themselves, and
      // the JWT is the only trustworthy statement of who that is.
      patientId: req.user.id,
      recordedAt: recordedAt ?? new Date(),
      heartRate: heartRate ?? null,
      systolic: systolic ?? null,
      diastolic: diastolic ?? null,
      weightKg: weightKg ?? null,
    },
  });

  res.status(201).json(vital);
});

// READ (list) — GET /api/vitals
// Always the caller's own readings. There is no way to ask for someone else's.
exports.getVitals = asyncHandler(async (req, res) => {
  const take = Math.min(Number(req.query.limit) || 100, 500);

  const vitals = await prisma.vital.findMany({
    where: { patientId: req.user.id },
    orderBy: { recordedAt: 'asc' }, // oldest first: charts read left to right
    take,
  });

  res.json(vitals);
});

// DELETE — DELETE /api/vitals/:id
exports.deleteVital = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);

  const existing = await prisma.vital.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError('Reading not found', 404);
  }
  if (existing.patientId !== req.user.id) {
    throw new AppError('Not authorized to delete this reading', 403);
  }

  await prisma.vital.delete({ where: { id } });
  res.json({ message: 'Reading deleted' });
});
