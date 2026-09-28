// Meal rules for the Profile screens (DATA-10, UX-17).

/** UX-00: meal names are 1–40 chars after trim. */
export const MEAL_NAME_MAX = 40;

export function isValidMealName(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length > 0 && trimmed.length <= MEAL_NAME_MAX;
}

/**
 * UX-17 non-blocking warning: another meal (not `excludeId`) already has this name. Names may repeat (DATA-10), so
 * this never blocks a save. Comparison is trimmed and case-insensitive.
 */
export function duplicateMealName(
  meals: readonly { id: string; name: string }[],
  name: string,
  excludeId?: string,
): string | null {
  const wanted = name.trim().toLocaleLowerCase();
  if (wanted.length === 0) return null;
  return meals.find((m) => m.id !== excludeId && m.name.trim().toLocaleLowerCase() === wanted)?.name ?? null;
}

/** UX-17 a11y `Move up` / `Move down`: the new ID order, or `null` when the move is out of bounds. */
export function moveMeal(orderedIds: readonly string[], id: string, delta: -1 | 1): string[] | null {
  const from = orderedIds.indexOf(id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= orderedIds.length) return null;
  const next = [...orderedIds];
  next.splice(from, 1);
  next.splice(to, 0, id);
  return next;
}

/** UX-17 drag drop: the new ID order with `id` moved to `toIndex` (clamped), or `null` when nothing moves. */
export function moveMealToIndex(orderedIds: readonly string[], id: string, toIndex: number): string[] | null {
  const from = orderedIds.indexOf(id);
  if (from < 0) return null;
  const to = Math.max(0, Math.min(orderedIds.length - 1, toIndex));
  if (to === from) return null;
  const next = [...orderedIds];
  next.splice(from, 1);
  next.splice(to, 0, id);
  return next;
}

/** UX-17 drag: the row index a drag of `translationY` from row `from` drops on (rows of `rowHeight`, clamped). */
export function dropIndex(from: number, translationY: number, rowHeight: number, count: number): number {
  if (rowHeight <= 0 || count <= 0) return from;
  return Math.max(0, Math.min(count - 1, from + Math.round(translationY / rowHeight)));
}
