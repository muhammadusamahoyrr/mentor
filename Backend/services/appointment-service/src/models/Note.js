const mongoose = require('mongoose');

/**
 * Clinical note attached to an appointment.
 *
 * Demonstrates a classic one-to-many ORM relationship:
 *   Appointment (one)  ->  Note (many)
 *
 * The `appointment` field is a real Mongoose reference (ObjectId + ref),
 * so notes can be joined back to their parent appointment via `.populate()`.
 */
const noteSchema = new mongoose.Schema(
  {
    // Relationship: each note belongs to exactly one Appointment.
    appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
      required: true,
      index: true,
    },

    // Who wrote the note (denormalized for display).
    authorId: { type: String, required: true },
    authorName: { type: String },
    authorRole: { type: String, enum: ['doctor', 'patient'] },

    body: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Note', noteSchema);
