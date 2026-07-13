const AuditLog = require('../AuditLog');

// These tests exercise the schema in-memory via validateSync() — no DB connection.
describe('AuditLog model', () => {
  it('is valid when required fields (topic, payload) are present', () => {
    const doc = new AuditLog({
      topic: 'appointment.created',
      payload: { appointmentId: 'abc123' },
    });

    const err = doc.validateSync();
    expect(err).toBeUndefined();
  });

  it('is invalid when topic is missing', () => {
    const doc = new AuditLog({ payload: { foo: 'bar' } });

    const err = doc.validateSync();
    expect(err).toBeDefined();
    expect(err.errors.topic).toBeDefined();
  });

  it('is invalid when payload is missing', () => {
    const doc = new AuditLog({ topic: 'user.registered' });

    const err = doc.validateSync();
    expect(err).toBeDefined();
    expect(err.errors.payload).toBeDefined();
  });

  it('defaults timestamp to a Date', () => {
    const doc = new AuditLog({ topic: 't', payload: {} });
    expect(doc.timestamp).toBeInstanceOf(Date);
  });
});
