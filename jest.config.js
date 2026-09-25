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
  testPathIgnorePatterns: ['/node_modules/', '/ios/', '/android/'],
};
