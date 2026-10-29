module.exports = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/test-support/jest.setup.js'],
  // Keep globs platform-neutral: an expanded Windows root uses backslashes and matches no files.
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // jest-expo + Expo 58: dev-only HMR client needs a browser `window`; stub it in tests.
    '^\./(setupHMR|setupFastRefresh|messageSocket)$': '<rootDir>/test-support/empty.js',
  },
  // Windows: avoid spawning `find` for the haste crawl (crashes with ENOTCONN here).
  haste: { ...require('jest-expo/jest-preset').haste, forceNodeFilesystemAPI: true },
  watchman: false,
  // @noble/* ships ES modules only; let babel turn them into CommonJS for tests.
  transformIgnorePatterns: [
    '/node_modules/(?!(.pnpm|react-native|@react-native|@react-native-community|expo|@expo|@expo-google-fonts|react-navigation|@react-navigation|@sentry/react-native|native-base|standard-navigation|@noble))',
    '/node_modules/react-native-reanimated/plugin/',
    '/node_modules/@react-native/babel-preset/',
  ],
  // Slow Windows disks and a running dev server can push the first render of a suite past the 5s default.
  testTimeout: 30000,
};
