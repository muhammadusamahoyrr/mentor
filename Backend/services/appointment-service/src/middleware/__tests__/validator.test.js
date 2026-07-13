const { validate, appointmentSchemas } = require('../validator');

// Helper: build a mock Express req and a next() spy, then run the middleware.
const runValidator = (schema, body) => {
  const req = { body };
  const res = {};
  const next = jest.fn();
  validate(schema)(req, res, next);
  return next;
};

describe('validate() middleware', () => {
  describe('appointment create schema', () => {
    const schema = appointmentSchemas.create;

    it('calls next() with no error when all fields are valid', () => {
      const next = runValidator(schema, {
        doctorId: 'doc123',
        date: '2026-08-01',
        time: '10:30',
        reason: 'Checkup',
      });

      expect(next).toHaveBeenCalledTimes(1);
      // next() called with no argument means validation passed
      expect(next).toHaveBeenCalledWith();
    });

    it('rejects with 400 when a required field is missing', () => {
      const next = runValidator(schema, {
        // doctorId missing
        date: '2026-08-01',
        time: '10:30',
        reason: 'Checkup',
      });

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(Error);
      expect(err.statusCode).toBe(400);
      expect(err.message).toContain('doctorId is required');
    });

    it('rejects with 400 when a required field is an empty string', () => {
      const next = runValidator(schema, {
        doctorId: 'doc123',
        date: '2026-08-01',
        time: '10:30',
        reason: '',
      });

      const err = next.mock.calls[0][0];
      expect(err.statusCode).toBe(400);
      expect(err.message).toContain('reason is required');
    });

    it('rejects with 400 when date is not a valid date', () => {
      const next = runValidator(schema, {
        doctorId: 'doc123',
        date: 'not-a-date',
        time: '10:30',
        reason: 'Checkup',
      });

      const err = next.mock.calls[0][0];
      expect(err.statusCode).toBe(400);
      expect(err.message).toContain('date must be a valid date');
    });

    it('aggregates multiple validation errors into one message', () => {
      const next = runValidator(schema, {}); // everything missing

      const err = next.mock.calls[0][0];
      expect(err.statusCode).toBe(400);
      expect(err.message).toContain('doctorId is required');
      expect(err.message).toContain('date is required');
      expect(err.message).toContain('time is required');
      expect(err.message).toContain('reason is required');
    });
  });

  describe('appointment updateStatus schema', () => {
    const schema = appointmentSchemas.updateStatus;

    it('accepts an allowed status value', () => {
      const next = runValidator(schema, { status: 'confirmed' });
      expect(next).toHaveBeenCalledWith();
    });

    it('rejects a status value outside the enum', () => {
      const next = runValidator(schema, { status: 'archived' });
      const err = next.mock.calls[0][0];
      expect(err.statusCode).toBe(400);
      expect(err.message).toContain('status must be one of');
    });

    it('rejects when status is missing', () => {
      const next = runValidator(schema, {});
      const err = next.mock.calls[0][0];
      expect(err.statusCode).toBe(400);
      expect(err.message).toContain('status is required');
    });
  });
});
