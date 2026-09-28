// ARCH-18: dev-only deep link `calorietracker://dev-seed` asks the running app to insert the local Maestro fixtures
// (bootstrap/devSeed.ts), so every flow runs against one normal Metro with no seed env flag. Callers guard with
// `__DEV__`, so release bundles drop it (ARCH-14: nothing dev-only ships active).

type Listener = () => void;

let listener: Listener | undefined;
let pending = false;

/** True for `calorietracker://dev-seed` (with or without scheme, slashes or query). */
export function isDevSeedLink(path: string): boolean {
  return /^(?:[a-z][a-z0-9+.-]*:)?\/*dev-seed\/?(?:[?#].*)?$/i.test(path);
}

/** Runs the subscribed seeder now, or once one subscribes (a link can arrive before startup finishes). */
export function requestDevSeed(): void {
  if (listener) listener();
  else pending = true;
}

export function onDevSeedRequest(next: Listener): () => void {
  listener = next;
  if (pending) {
    pending = false;
    next();
  }
  return () => {
    if (listener === next) listener = undefined;
  };
}
