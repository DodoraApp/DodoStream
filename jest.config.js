module.exports = {
  preset: 'jest-expo',
  setupFiles: ['./jest.setup.js'],
  setupFilesAfterEnv: ['expo-sqlite-mock/src/setup.ts'],
  testTimeout: 10000,
  // The sync E2E suite hits real Trakt/Simkl APIs and requires interactive auth.
  // Run it explicitly via `pnpm test:e2e:sync*` (scripts/sync-e2e/jest-e2e.config.js).
  testPathIgnorePatterns: ['<rootDir>/scripts/sync-e2e/'],
};
