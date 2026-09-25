// Deterministic local-date tests (DATA-08): Portugal is the main market and has DST. Workers inherit this.
process.env.TZ = 'Europe/Lisbon';

/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  // Resolve Worklets' web implementation instead of the native module (Worklets Jest guide).
  resolver: 'react-native-worklets/jest/resolver',
  setupFiles: ['<rootDir>/jest.env.js'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  // jest-expo's list plus @formatjs (ESM-only Intl polyfills, ARCH-22).
  transformIgnorePatterns: [
    '/node_modules/(?!(.pnpm|react-native|@react-native|@react-native-community|expo|@expo|@expo-google-fonts|react-navigation|@react-navigation|@sentry/react-native|native-base|standard-navigation|@formatjs))',
    '/node_modules/react-native-reanimated/plugin/',
    '/node_modules/@react-native/babel-preset/',
  ],
  testPathIgnorePatterns: ['/node_modules/', '/ios/', '/android/'],
};
