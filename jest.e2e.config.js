// Runs against the stack in test/e2e/compose.yml; start it with `just e2e`.
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/test/e2e/**/*.test.js'],
  testTimeout: 30000,
};
