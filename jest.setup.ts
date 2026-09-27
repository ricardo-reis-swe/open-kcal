// Global test setup. Keep it minimal: per-suite mocks live next to the suites that need them.
import 'react-native-gesture-handler/jestSetup';
import { setUpTests } from 'react-native-reanimated';

setUpTests();

// The app logger writes info/debug to the console in dev; keep test output readable. warn/error stay visible.
jest.spyOn(console, 'info').mockImplementation(() => undefined);
jest.spyOn(console, 'debug').mockImplementation(() => undefined);

// ARCH-18: app code opens SQLite through expo-sqlite; in Jest that's real SQL on Node's built-in SQLite.
jest.mock('expo-sqlite', () => require('./src/shared/testing/expoSqliteMock'));

// expo-crypto's native randomUUID, backed by Node's (same RFC 9562 v4 output).
jest.mock('expo-crypto', () => ({ randomUUID: () => require('crypto').randomUUID() }));

// ARCH-12: native connectivity is represented by the package's deterministic test implementation.
jest.mock('@react-native-community/netinfo', () => require('@react-native-community/netinfo/jest/netinfo-mock'));
