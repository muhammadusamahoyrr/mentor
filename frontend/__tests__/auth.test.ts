import { describe, it, expect, beforeEach, vi } from 'vitest';
import { login, register, getCurrentUser } from '../lib/auth';

// These tests cover the offline fallback in lib/auth: when the backend is
// unreachable, register/login/getCurrentUser fall back to localStorage.
//
// They used to reach the network for real and pass only because nothing happened
// to be listening on the dev port — so they broke the moment a connection to a
// dead port started hanging instead of being refused. A unit test must not
// depend on that. Stubbing the HTTP layer makes "the backend is unreachable" an
// explicit precondition rather than an accident of the machine.
vi.mock('../lib/api', () => ({
  default: {
    get: vi.fn(() => Promise.reject(new Error('Network Error'))),
    post: vi.fn(() => Promise.reject(new Error('Network Error'))),
  },
}));

describe('auth utilities', () => {
  beforeEach(() => {
    localStorage.clear();
    // The bare fetch() calls in lib/auth (appointments, notifications, files)
    // must fail the same way, without touching the network.
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('Network Error'))));
  });

  describe('register', () => {
    it('returns a user object with the correct name and role', async () => {
      const result = await register({
        name: 'Alice Smith',
        email: 'alice@test.com',
        password: 'pass123',
        role: 'patient',
      });

      expect(result.user.name).toBe('Alice Smith');
      expect(result.user.role).toBe('patient');
      expect(result.user.email).toBe('alice@test.com');
    });

    it('returns a mock token', async () => {
      const result = await register({
        name: 'Bob',
        email: 'bob@test.com',
        password: 'pass',
        role: 'patient',
      });

      expect(result.token).toBe('mock-token');
    });

    it('persists the user to localStorage', async () => {
      await register({
        name: 'Carol',
        email: 'carol@test.com',
        password: 'pass',
        role: 'doctor',
        specialization: 'Neurology',
      });

      const stored = localStorage.getItem('careloop_user');
      expect(stored).not.toBeNull();
      const user = JSON.parse(stored!);
      expect(user.email).toBe('carol@test.com');
      expect(user.specialization).toBe('Neurology');
    });
  });

  describe('getCurrentUser', () => {
    it('returns null when no user is stored', async () => {
      const user = await getCurrentUser();
      expect(user).toBeNull();
    });

    it('returns the user after registration', async () => {
      await register({
        name: 'Dana',
        email: 'dana@test.com',
        password: 'pass',
        role: 'patient',
      });

      const user = await getCurrentUser();
      expect(user).not.toBeNull();
      expect(user?.name).toBe('Dana');
    });

    it('returns null after clearing localStorage', async () => {
      await register({ name: 'Eve', email: 'eve@test.com', password: 'pass', role: 'patient' });
      localStorage.removeItem('careloop_user');
      const user = await getCurrentUser();
      expect(user).toBeNull();
    });
  });

  describe('login', () => {
    it('logs in a previously registered user', async () => {
      await register({
        name: 'Frank',
        email: 'frank@test.com',
        password: 'secret',
        role: 'doctor',
        specialization: 'Cardiology',
      });
      localStorage.removeItem('careloop_user');

      const result = await login({ email: 'frank@test.com', password: 'secret' });
      expect(result.user.name).toBe('Frank');
      expect(result.user.role).toBe('doctor');
    });

    it('logs in as demo patient for any unknown email', async () => {
      const result = await login({ email: 'anyone@example.com', password: 'anypass' });
      expect(result.user.role).toBe('patient');
      expect(result.token).toBe('mock-token');
    });

    it('persists user to localStorage after login', async () => {
      await login({ email: 'test@demo.com', password: '123' });
      const user = await getCurrentUser();
      expect(user).not.toBeNull();
    });
  });
});
