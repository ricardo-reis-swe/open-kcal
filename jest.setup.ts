// Global test setup. Keep it minimal: per-suite mocks live next to the suites that need them.
import 'react-native-gesture-handler/jestSetup';
import { timeoutManager } from '@tanstack/react-query';
import { setUpTests } from 'react-native-reanimated';

setUpTests();

// TanStack Query keeps 5-minute garbage-collection timers, including on queries already dropped from the cache
// (out of reach of `client.clear()`). Unref them so they never hold a Jest worker open; they still fire normally.
timeoutManager.setTimeoutProvider({
  setTimeout: (callback, delay) => {
    const id = setTimeout(callback, delay);
    (id as { unref?: () => void }).unref?.();
    return id;
  },
  clearTimeout: (id) => clearTimeout(id),
  setInterval: (callback, delay) => setInterval(callback, delay),
  clearInterval: (id) => clearInterval(id),
});

// The app logger writes info/debug to the console in dev; keep test output readable. warn/error stay visible.
jest.spyOn(console, 'info').mockImplementation(() => undefined);
jest.spyOn(console, 'debug').mockImplementation(() => undefined);

// ARCH-18: app code opens SQLite through expo-sqlite; in Jest that's real SQL on Node's built-in SQLite.
jest.mock('expo-sqlite', () => require('./src/shared/testing/expoSqliteMock'));

// expo-crypto's native randomUUID, backed by Node's (same RFC 9562 v4 output).
jest.mock('expo-crypto', () => ({ randomUUID: () => require('crypto').randomUUID() }));

// ARCH-12: native connectivity is represented by the package's deterministic test implementation.
jest.mock('@react-native-community/netinfo', () => require('@react-native-community/netinfo/jest/netinfo-mock'));

// ARCH-23: the Android widget library's native module doesn't exist in Jest.
jest.mock('react-native-android-widget', () => require('./src/shared/testing/androidWidgetMock'));

// ARCH-24: expo-camera's native view and permissions don't exist in Jest.
jest.mock('expo-camera', () => require('./src/shared/testing/expoCameraMock'));

// Recipe text copy/import uses Expo Clipboard; the test implementation is an in-memory clipboard.
jest.mock('expo-clipboard', () => require('./src/shared/testing/expoClipboardMock'));

// ARCH-25: file operations run on real temp files; the share sheet and document picker are system UI.
jest.mock('@/data/db/transfer/files', () => require('./src/shared/testing/nodeFiles'));
jest.mock('@/shared/files/fileTransfer', () => require('./src/shared/testing/fileTransferMock'));
