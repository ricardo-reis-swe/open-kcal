// ARCH-18: incoming links pass through unchanged, except the dev-only Maestro seed link (bootstrap/devSeedLink.ts),
// which runs the local fixtures seed and keeps the current screen. `__DEV__` compiles that branch out of release.
// NAV-10: the widget link opens the Diary on a cold start; warm, it keeps the current screen and asks the Diary root.
import { isDevSeedLink, requestDevSeed } from '@/bootstrap/devSeedLink';
import { isWidgetLink, requestWidgetToday } from '@/shared/navigation/widgetLink';

export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }): string | null {
  if (isWidgetLink(path)) {
    if (initial) return '/diary';
    requestWidgetToday();
    return null;
  }
  if (__DEV__ && isDevSeedLink(path)) {
    requestDevSeed();
    return null;
  }
  return path;
}
