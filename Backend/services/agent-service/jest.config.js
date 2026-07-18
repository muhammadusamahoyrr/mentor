module.exports = {
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/jest.setup.js'],
  testMatch: ['**/__tests__/**/*.test.js'],
  // Serial: skill/loop suites share process-level env (AGENT_DOCS_DIR, keys).
  maxWorkers: 1,
};
