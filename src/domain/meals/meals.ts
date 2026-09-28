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
