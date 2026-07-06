const { createNoteSchema, updateNoteSchema } = require('../noteSchema');

// Pure validation unit tests — no DB, no HTTP.
describe('createNoteSchema', () => {
  it('accepts a valid note payload', () => {
    const result = createNoteSchema.safeParse({
      doctorId: 1,
      title: 'BP reading',
      content: '120/80',
    });
    expect(result.success).toBe(true);
  });

  it('coerces a numeric string doctorId to a number', () => {
    const result = createNoteSchema.safeParse({
      doctorId: '3',
      title: 'Meds',
      content: 'Took aspirin',
    });
    expect(result.success).toBe(true);
    expect(result.data.doctorId).toBe(3);
  });

  it('rejects an empty title', () => {
    const result = createNoteSchema.safeParse({
      doctorId: 1,
      title: '',
      content: 'x',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a missing content field', () => {
    const result = createNoteSchema.safeParse({ doctorId: 1, title: 'x' });
    expect(result.success).toBe(false);
  });

  it('rejects a non-positive doctorId', () => {
    const result = createNoteSchema.safeParse({
      doctorId: 0,
      title: 'x',
      content: 'y',
    });
    expect(result.success).toBe(false);
  });
});

describe('updateNoteSchema', () => {
  it('accepts a partial update with only a title', () => {
    const result = updateNoteSchema.safeParse({ title: 'New title' });
    expect(result.success).toBe(true);
  });

  it('rejects an empty update (no fields provided)', () => {
    const result = updateNoteSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
