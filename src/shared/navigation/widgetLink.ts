// NAV-10: the widget's `calorietracker://diary/today` link. A warm tap asks the Diary root to show today; the root
// decides whether it may (nothing on top of it). Cold start needs nothing: a fresh launch is already today (NAV-05).

type Listener = () => void;

let listener: Listener | undefined;

/** True for `calorietracker://diary/today` (with or without scheme, slashes or query). */
export function isWidgetLink(path: string): boolean {
  return /^(?:[a-z][a-z0-9+.-]*:)?\/*diary\/today\/?(?:[?#].*)?$/i.test(path);
}

/** Tells the mounted Diary root; dropped when none is mounted (the tap then just brings the app to the front). */
export function requestWidgetToday(): void {
  listener?.();
}

export function onWidgetTodayRequest(next: Listener): () => void {
  listener = next;
  return () => {
    if (listener === next) listener = undefined;
  };
}
