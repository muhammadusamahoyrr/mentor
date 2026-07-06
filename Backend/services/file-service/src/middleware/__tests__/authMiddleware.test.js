const { authorizeRole } = require('../authMiddleware');

// Minimal Express res mock: status() is chainable and returns res.
const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('authorizeRole middleware', () => {
  it('calls next() when the user has an allowed role', () => {
    const req = { user: { role: 'doctor' } };
    const res = mockRes();
    const next = jest.fn();

    authorizeRole('doctor')(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('accepts a role passed inside an array (roles are flattened)', () => {
    const req = { user: { role: 'patient' } };
    const res = mockRes();
    const next = jest.fn();

    authorizeRole(['doctor', 'patient'])(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('responds 403 when the user role is not allowed', () => {
    const req = { user: { role: 'patient' } };
    const res = mockRes();
    const next = jest.fn();

    authorizeRole('doctor')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('responds 403 when there is no authenticated user', () => {
    const req = {};
    const res = mockRes();
    const next = jest.fn();

    authorizeRole('doctor')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
