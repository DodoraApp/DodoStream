module.exports = {
  preset: 'jest-expo',
  setupFiles: ['./jest.setup.js'],
  setupFilesAfterEnv: ['expo-sqlite-mock/src/setup.ts'],
  testTimeout: 10000,
};
