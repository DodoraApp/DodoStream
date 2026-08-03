/**
 * Jest configuration for sync E2E tests.
 *
 * These tests run against real Trakt/Simkl APIs and use Jest's module mocking
 * instead of the fragile Module._load interception.
 *
 * `jest-expo` preset provides the tsconfig-paths moduleNameMapper for `@/*`
 * aliases and the babel transform needed by the imported sync services —
 * identical resolution to the unit-test config.
 */

module.exports = {
  preset: 'jest-expo',
  testEnvironment: 'node',
  rootDir: '../..',
  testMatch: ['<rootDir>/scripts/sync-e2e/sync-e2e.test.ts'],
  setupFiles: ['jest-expo/src/preset/setup.js', '<rootDir>/scripts/sync-e2e/jest-e2e-setup.ts'],
  testTimeout: 120000, // 2 minutes for real API calls
  // The suite shares one real remote account per provider and relies on
  // test order (cleanup afterEach + per-test seeds). Must never run parallel.
  maxWorkers: 1,
};
