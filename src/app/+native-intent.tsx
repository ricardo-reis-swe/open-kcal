// ARCH-18: incoming links pass through unchanged, except the dev-only Maestro seed link (bootstrap/devSeedLink.ts),
// which runs the local fixtures seed and keeps the current screen. `__DEV__` compiles that branch out of release.
import { isDevSeedLink, requestDevSeed } from '@/bootstrap/devSeedLink';

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string | null {
  if (__DEV__ && isDevSeedLink(path)) {
    requestDevSeed();
    return null;
  }
  return path;
}
