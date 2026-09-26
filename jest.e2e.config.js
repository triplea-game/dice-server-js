// Runs against the stack in test/e2e/compose.yml; start it with `just e2e`.
// Covers the contract tests on real Postgres/SMTP and the smoke tests on the image.
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/test/contract/**/*.test.js', '<rootDir>/test/e2e/**/*.test.js'],
  testTimeout: 30000,
};
