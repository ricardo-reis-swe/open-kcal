// DATA-21 dashboard nutrients setting: which catalog nutrients the Diary panel shows, in order (UX-02, UX-21).
import { z } from 'zod';

import { NUTRIENT_IDS, isNutrientId, type NutrientId } from './nutrientCatalog';

export type DashboardNutrient = { id: NutrientId; visible: boolean };
export type DashboardNutrients = readonly DashboardNutrient[];

const DEFAULT_VISIBLE: readonly NutrientId[] = ['fibre', 'sugars', 'saturated_fat', 'salt'];

/** Completes a list to one entry per catalog id: drops unknown ids and duplicates, appends missing ids hidden. */
function complete(items: readonly { id: string; visible: boolean }[]): DashboardNutrient[] {
  const seen = new Set<NutrientId>();
  const result: DashboardNutrient[] = [];
  for (const item of items) {
    if (!isNutrientId(item.id) || seen.has(item.id)) continue;
    seen.add(item.id);
    result.push({ id: item.id, visible: item.visible });
  }
  for (const id of NUTRIENT_IDS) if (!seen.has(id)) result.push({ id, visible: false });
  return result;
}

/** DATA-21 default: fibre, sugars, saturated fat, salt visible, then every other catalog id hidden. */
export const DEFAULT_DASHBOARD_NUTRIENTS: DashboardNutrients = complete(
  DEFAULT_VISIBLE.map((id) => ({ id, visible: true })),
);

const storedSchema = z.array(z.object({ id: z.string(), visible: z.boolean() }));

/** DATA-21 read: tolerant of catalog growth; unparseable data falls back to the default (never throws). */
export function parseDashboardNutrients(json: unknown): DashboardNutrients {
  if (typeof json !== 'string') return DEFAULT_DASHBOARD_NUTRIENTS;
  try {
    const parsed = storedSchema.safeParse(JSON.parse(json));
    return parsed.success ? complete(parsed.data) : DEFAULT_DASHBOARD_NUTRIENTS;
  } catch {
    return DEFAULT_DASHBOARD_NUTRIENTS;
  }
}

/** Writes must hold every catalog id exactly once (the repository rejects anything else). */
export function isValidDashboardNutrients(value: readonly { id: string; visible: boolean }[]): boolean {
  return value.length === NUTRIENT_IDS.length && complete(value).every((item, i) => item.id === value[i]!.id);
}

/** Visible ids in dashboard order: what the Diary panel renders (UX-02). */
export function visibleDashboardNutrients(items: DashboardNutrients): NutrientId[] {
  return items.filter((item) => item.visible).map((item) => item.id);
}

/**
 * UX-21 switch: turning one on appends it after the last shown nutrient; turning it off only hides it (hidden rows
 * render by catalog group). `null` when nothing changes.
 */
export function setDashboardNutrientVisible(
  items: DashboardNutrients,
  id: NutrientId,
  visible: boolean,
): DashboardNutrient[] | null {
  const current = items.find((item) => item.id === id);
  if (!current || current.visible === visible) return null;
  if (!visible) return items.map((item) => (item.id === id ? { id, visible: false } : item));
  const rest = items.filter((item) => item.id !== id);
  const lastShown = rest.reduce((last, item, i) => (item.visible ? i : last), -1);
  return [...rest.slice(0, lastShown + 1), { id, visible: true }, ...rest.slice(lastShown + 1)];
}

/** UX-21 drop / a11y move within `Shown`: `id` moves to position `toIndex` among the shown ones (clamped). */
export function moveDashboardNutrient(
  items: DashboardNutrients,
  id: NutrientId,
  toIndex: number,
): DashboardNutrient[] | null {
  const shown = items.filter((item) => item.visible);
  const from = shown.findIndex((item) => item.id === id);
  if (from < 0) return null;
  const to = Math.max(0, Math.min(shown.length - 1, toIndex));
  if (to === from) return null;
  const reordered = [...shown];
  const [moved] = reordered.splice(from, 1);
  reordered.splice(to, 0, moved!);
  return [...reordered, ...items.filter((item) => !item.visible)];
}
