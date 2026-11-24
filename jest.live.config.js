// POST-08: the live provider suite. Not part of `npm test`; run with `npm run test:live`.
const base = require('./jest.config.js');

/** @type {import('jest').Config} */
module.exports = {
  ...base,
  testEnvironment: '<rootDir>/jest.live.env.js',
  testMatch: ['<rootDir>/src/data/api/__live__/**/*.live.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/ios/', '/android/'],
  testTimeout: 180_000,
};
