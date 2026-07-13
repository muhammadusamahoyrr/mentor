module.exports = {
  testEnvironment: 'node',
  globalSetup: '<rootDir>/jest.globalSetup.js',
  setupFiles: ['<rootDir>/jest.setup.js'],
  testMatch: ['**/__tests__/**/*.test.js'],
  // Prisma + supertest share one SQLite file; running suites in parallel would
  // have them truncating each other's tables mid-assertion.
  maxWorkers: 1,
};
