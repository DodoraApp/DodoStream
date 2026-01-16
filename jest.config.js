module.exports = {
    preset: 'jest-expo',
    setupFiles: ['./jest.setup.js'],
    moduleNameMapper: {
        '^modules/mpv$': '<rootDir>/modules/__mocks__/modules-mpv.ts',
    },
};
