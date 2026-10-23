module.exports = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/test-support/jest.setup.js'],
  testMatch: ['<rootDir>/__tests__/**/*.test.(ts|tsx)'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // jest-expo + Expo 58: dev-only HMR client needs a browser `window`; stub it in tests.
    '^\./(setupHMR|setupFastRefresh|messageSocket)$': '<rootDir>/test-support/empty.js',
  },
  // Windows: avoid spawning `find` for the haste crawl (crashes with ENOTCONN here).
  haste: { ...require('jest-expo/jest-preset').haste, forceNodeFilesystemAPI: true },
  watchman: false,
};
