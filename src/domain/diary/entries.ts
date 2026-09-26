// Diary entry rules that don't need the DB (DATA-06, DATA-12, DATA-16).
import { z } from 'zod';

import { energyFromKcal, energyToKcal, type EnergyUnit } from '../units/units';

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

/** UX-00: Quick Calories energy is 1–10,000 kcal (canonical). */
export const QUICK_CALORIES_MIN_KCAL = 1;
export const QUICK_CALORIES_MAX_KCAL = 10_000;
/** UX-07: the note is one optional line of up to 80 characters. */
export const QUICK_CALORIES_NOTE_MAX = 80;

/** The valid whole-number range in the user's energy unit, e.g. 1–10,000 kcal or 5–41,840 kJ (UX-00, DATA-04). */
export function quickCaloriesRange(unit: EnergyUnit): { min: number; max: number } {
  // The epsilon keeps float noise (41840 / 4.184 = 10000.000000000002) from dropping an exact bound.
  return {
    min: Math.ceil(energyFromKcal(QUICK_CALORIES_MIN_KCAL, unit) - 1e-9),
    max: Math.floor(energyFromKcal(QUICK_CALORIES_MAX_KCAL, unit) + 1e-9),
  };
}

/**
 * UX-07: parses the Calories field (an integer in the energy unit) to canonical kcal, or `null` when it isn't a whole
 * number inside `quickCaloriesRange`. Whitespace around the digits is ignored.
 */
export function parseQuickCaloriesInput(text: string, unit: EnergyUnit): number | null {
  const trimmed = text.trim();
  if (!/^\d{1,6}$/.test(trimmed)) return null;
  const value = Number(trimmed);
  const { min, max } = quickCaloriesRange(unit);
  if (value < min || value > max) return null;
  return energyToKcal(value, unit);
}

/** ARCH-03 / UX-07: validates the complete Quick Calories form at its UI boundary. */
export function quickCaloriesFormSchema(unit: EnergyUnit) {
  return z.object({
    mealId: z.string().min(1),
    calories: z.string().refine((value) => parseQuickCaloriesInput(value, unit) !== null),
    note: z.string().max(QUICK_CALORIES_NOTE_MAX),
  });
}

export type QuickCaloriesFormValues = z.infer<ReturnType<typeof quickCaloriesFormSchema>>;
