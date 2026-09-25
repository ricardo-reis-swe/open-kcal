import { renderRouter } from 'expo-router/testing-library';
import { Text } from 'react-native';

import TabsLayout from '@/app/(tabs)/_layout';
import DiaryStackLayout from '@/app/(tabs)/diary/_layout';
import DiaryIndex from '@/app/(tabs)/diary/index';
import ProfileStackLayout from '@/app/(tabs)/profile/_layout';
import ProfileIndex from '@/app/(tabs)/profile/index';
import RootLayout from '@/app/_layout';
import Index from '@/app/index';

/** The real route tree for Expo Router in-memory tests (ARCH-18), plus optional extra mock routes. */
export function appRoutes(extra: Record<string, () => React.ReactElement> = {}) {
  return {
    _layout: RootLayout,
    index: Index,
    '(tabs)/_layout': TabsLayout,
    '(tabs)/diary/_layout': DiaryStackLayout,
    '(tabs)/diary/index': DiaryIndex,
    '(tabs)/profile/_layout': ProfileStackLayout,
    '(tabs)/profile/index': ProfileIndex,
    ...extra,
  };
}

/** A deeper stack screen used to test stack behavior before real deeper screens exist. */
export function MockDeepScreen() {
  return <Text>Deep screen</Text>;
}

/**
 * Renders the real app at `initialUrl`. RNTL 14's `render` is async, so the router's `getPathname()` lives on the
 * un-awaited result; this keeps it reachable (the `toHavePathname` matcher can't see it through `screen`).
 */
export async function renderApp(initialUrl: string, extra: Record<string, () => React.ReactElement> = {}) {
  const result = renderRouter(appRoutes(extra), { initialUrl });
  await result;
  return { getPathname: () => result.getPathname() };
}
