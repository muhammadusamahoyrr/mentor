const mongoose = require('mongoose');
const Note = require('../Note');

// Verifies the Appointment -> Note relationship is modeled correctly.
// Runs in-memory (validateSync / schema introspection) — no DB connection.
describe('Note model (Appointment -> Notes relationship)', () => {
  it('models `appointment` as a required ObjectId reference to Appointment', () => {
    const path = Note.schema.path('appointment');

    expect(path.instance).toBe('ObjectId');
    expect(path.options.ref).toBe('Appointment');
    expect(path.isRequired).toBe(true);
  });

  it('is valid with an appointment reference and a body', () => {
    const note = new Note({
      appointment: new mongoose.Types.ObjectId(),
      authorId: 'user-123',
      authorName: 'Dr. House',
      authorRole: 'doctor',
      body: 'Patient is stable, follow up in two weeks.',
    });

    expect(note.validateSync()).toBeUndefined();
  });

  it('is invalid when the appointment reference is missing', () => {
    const note = new Note({ authorId: 'user-123', body: 'orphan note' });

    const err = note.validateSync();
    expect(err).toBeDefined();
    expect(err.errors.appointment).toBeDefined();
  });

  it('is invalid when the body is missing', () => {
    const note = new Note({
      appointment: new mongoose.Types.ObjectId(),
      authorId: 'user-123',
    });

    const err = note.validateSync();
    expect(err).toBeDefined();
    expect(err.errors.body).toBeDefined();
  });

  it('rejects an authorRole outside the allowed enum', () => {
    const note = new Note({
      appointment: new mongoose.Types.ObjectId(),
      authorId: 'user-123',
      authorRole: 'admin',
      body: 'note',
    });

    const err = note.validateSync();
    expect(err.errors.authorRole).toBeDefined();
  });
});
