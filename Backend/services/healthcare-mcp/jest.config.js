module.exports = {
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/jest.setup.js'],
  testMatch: ['**/__tests__/**/*.test.js'],
  // Serial: the suites share process-level env (tokens, service URLs).
  maxWorkers: 1,
};
