const prisma = require('../db');
const { AppError, asyncHandler } = require('../middleware/errorHandler');

// CREATE a doctor — POST /api/doctors  (the parent, so notes can be attached)
exports.createDoctor = asyncHandler(async (req, res) => {
  const { name, email, specialization } = req.body;

  if (!name || !email) {
    throw new AppError('name and email are required', 400);
  }

  const doctor = await prisma.doctor.create({
    data: { name, email, specialization },
  });
  res.status(201).json(doctor);
});

// LIST doctors with their notes — GET /api/doctors  (relationship, the other direction)
exports.getDoctors = asyncHandler(async (req, res) => {
  const doctors = await prisma.doctor.findMany({
    include: { notes: true }, // each doctor comes back with their notes nested
    orderBy: { id: 'asc' },
  });
  res.json(doctors);
});
