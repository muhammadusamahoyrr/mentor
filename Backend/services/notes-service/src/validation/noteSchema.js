const { z } = require('zod');

// Zod schemas validate the request body before it reaches the controller.

const createNoteSchema = z.object({
  doctorId: z.coerce.number().int().positive(),
  title: z.string().trim().min(1, 'title is required').max(120),
  content: z.string().trim().min(1, 'content is required'),
});

// Update is a partial edit: at least one editable field must be present.
const updateNoteSchema = z
  .object({
    title: z.string().trim().min(1).max(120).optional(),
    content: z.string().trim().min(1).optional(),
  })
  .refine((data) => data.title !== undefined || data.content !== undefined, {
    message: 'At least one of title or content must be provided',
  });

module.exports = { createNoteSchema, updateNoteSchema };
