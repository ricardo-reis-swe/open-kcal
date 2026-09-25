// Diary entry rules that don't need the DB (DATA-06, DATA-12, DATA-16).

export type EntryKind = 'food' | 'quick_calories';

/** Quick Calories note: trimmed; empty → `null` (DATA-06). */
export function normalizeNote(note: string | null | undefined): string | null {
  const trimmed = note?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

/** Quick Calories accepts kcal ≥ 0 at the data layer (the UI requires ≥ 1, UX-07). */
export function isValidQuickCaloriesKcal(kcal: number): boolean {
  return Number.isFinite(kcal) && kcal >= 0;
}

/** Next `sort_order` when appending to a meal on a date. */
export function nextSortOrder(existing: readonly { sortOrder: number }[]): number {
  return existing.reduce((max, e) => Math.max(max, e.sortOrder + 1), 0);
}
