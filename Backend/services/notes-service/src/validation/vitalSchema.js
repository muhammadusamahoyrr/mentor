const { z } = require('zod');

// Ranges are deliberately wide — wide enough to admit a genuinely unwell person,
// narrow enough to catch a typo or a unit mix-up (lbs entered as kg, say). The
// point is to reject nonsense, not to diagnose.
const createVitalSchema = z
  .object({
    // Optional: a reading entered later can be backdated to when it was taken.
    recordedAt: z.coerce.date().optional(),

    heartRate: z.coerce.number().int().min(20).max(250).optional(),
    systolic: z.coerce.number().int().min(50).max(260).optional(),
    diastolic: z.coerce.number().int().min(30).max(200).optional(),
    weightKg: z.coerce.number().min(1).max(500).optional(),
  })
  .refine(
    (d) =>
      d.heartRate !== undefined ||
      d.systolic !== undefined ||
      d.diastolic !== undefined ||
      d.weightKg !== undefined,
    { message: 'Record at least one of heartRate, systolic, diastolic or weightKg' }
  )
  // Blood pressure is a pair. One half of it is not a reading.
  .refine((d) => (d.systolic === undefined) === (d.diastolic === undefined), {
    message: 'Blood pressure needs both systolic and diastolic',
  })
  .refine((d) => d.systolic === undefined || d.systolic > d.diastolic, {
    message: 'Systolic must be greater than diastolic',
  });

module.exports = { createVitalSchema };
