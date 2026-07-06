const { generateToken, verifyToken } = require('../jwt');

// Pure crypto — no DB or network needed, so this is a fast unit test.
describe('jwt utils', () => {
  const user = {
    _id: '507f1f77bcf86cd799439011',
    email: 'doc@example.com',
    role: 'doctor',
    name: 'Dr. Strange',
  };

  it('generateToken returns a signed JWT string with three segments', () => {
    const token = generateToken(user);
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);
  });

  it('verifyToken decodes a token back to the original payload', () => {
    const token = generateToken(user);
    const decoded = verifyToken(token);

    expect(decoded.email).toBe(user.email);
    expect(decoded.role).toBe(user.role);
    expect(decoded.name).toBe(user.name);
    expect(String(decoded.id)).toBe(String(user._id));
  });

  it('verifyToken throws on a malformed token', () => {
    expect(() => verifyToken('not.a.real.token')).toThrow('Invalid token');
  });

  it('verifyToken throws on an empty token', () => {
    expect(() => verifyToken('')).toThrow();
  });
});
