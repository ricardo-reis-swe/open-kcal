// Global test setup. Keep it minimal: per-suite mocks live next to the suites that need them.
import 'react-native-gesture-handler/jestSetup';
import { setUpTests } from 'react-native-reanimated';

setUpTests();

// The app logger writes info/debug to the console in dev; keep test output readable. warn/error stay visible.
jest.spyOn(console, 'info').mockImplementation(() => undefined);
jest.spyOn(console, 'debug').mockImplementation(() => undefined);
