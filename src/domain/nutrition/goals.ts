// Effective-dated nutrition goals (DATA-09, UX-01).
import { energyFromKcal, energyToKcal, type EnergyUnit } from '@/domain/units/units';
import type { LocalDate } from '@/shared/dates';

export type NutritionTargets = {
  calorieTargetKcal: number;
  carbohydrateTargetG: number;
  proteinTargetG: number;
  fatTargetG: number;
  macroTargetMode?: MacroTargetMode;
  carbohydrateTargetPercent?: number | null;
  proteinTargetPercent?: number | null;
  fatTargetPercent?: number | null;
};

export type MacroTargetMode = 'grams' | 'percent';

export type NutritionGoal = NutritionTargets & {
  id: string;
  effectiveFrom: LocalDate;
  macroTargetMode: MacroTargetMode;
  carbohydrateTargetPercent: number | null;
  proteinTargetPercent: number | null;
  fatTargetPercent: number | null;
};

/** UX-01 provisional goal: a fixed 50/20/30 split of 2,000 kcal, not a calculation (SCOPE-10). */
export const PROVISIONAL_TARGETS: NutritionTargets = {
  calorieTargetKcal: 2000,
  carbohydrateTargetG: 250,
  proteinTargetG: 100,
  fatTargetG: 67,
};

/** Goal for date D = the row with the greatest `effectiveFrom ≤ D`; `null` if none applies yet. */
export function resolveGoal<T extends { effectiveFrom: LocalDate }>(goals: readonly T[], date: LocalDate): T | null {
  let best: T | null = null;
  for (const goal of goals) {
    if (goal.effectiveFrom <= date && (best === null || goal.effectiveFrom > best.effectiveFrom)) best = goal;
  }
  return best;
}

export type GoalSavePlan =
  | { kind: 'updateInPlace'; goalId: string; effectiveFrom: LocalDate }
  | { kind: 'upsertEffectiveToday'; effectiveFrom: LocalDate };

/**
 * Where a goal save goes (DATA-09). While goals are provisional (`goals_confirmed_at` NULL) the first save updates
 * the provisional row in place so the user's goals apply from day one (UX-01). Otherwise it upserts the row
 * effective today; older rows never change.
 */
export function planGoalSave(goals: readonly NutritionGoal[], today: LocalDate, goalsConfirmed: boolean): GoalSavePlan {
  if (!goalsConfirmed) {
    const provisional = resolveGoal(goals, today) ?? goals[0];
    if (provisional) return { kind: 'updateInPlace', goalId: provisional.id, effectiveFrom: provisional.effectiveFrom };
  }
  return { kind: 'upsertEffectiveToday', effectiveFrom: today };
}

/** UX-00 goal ranges (canonical). */
export const GOAL_CALORIES_MIN_KCAL = 500;
export const GOAL_CALORIES_MAX_KCAL = 10_000;
export const GOAL_MACRO_MAX_G = 1_000;
export const GOAL_MACRO_MAX_PERCENT = 100;

/** UX-16 helper energy factors (4/4/9 kcal per g). */
export const KCAL_PER_GRAM = { carbohydrateG: 4, proteinG: 4, fatG: 9 } as const;

export type GoalMacroKey = keyof typeof KCAL_PER_GRAM;

export type MacroPercentages = { carbohydrateG: number; proteinG: number; fatG: number };

/** UX-16 percentage mode: each share of the calorie target becomes grams using the macro's 4/4/9 factor. */
export function gramsFromMacroPercent(calorieTargetKcal: number, percent: number, macro: GoalMacroKey): number {
  return (calorieTargetKcal * (percent / 100)) / KCAL_PER_GRAM[macro];
}

/** Switching from fixed grams normalizes their macro energy to a whole-number split that totals exactly 100%. */
export function percentagesFromMacroGrams(carbohydrateG: number, proteinG: number, fatG: number): MacroPercentages {
  const energies = [carbohydrateG * 4, proteinG * 4, fatG * 9];
  const total = energies.reduce((sum, value) => sum + value, 0);
  if (!(total > 0)) return { carbohydrateG: 0, proteinG: 0, fatG: 100 };
  const exact = energies.map((value) => (value / total) * 100);
  const base = exact.map(Math.floor);
  let remaining = 100 - base.reduce((sum, value) => sum + value, 0);
  const order = exact
    .map((value, index) => ({ index, remainder: value - base[index]! }))
    .sort((a, b) => b.remainder - a.remainder);
  for (let index = 0; index < remaining; index += 1) base[order[index]!.index]! += 1;
  return { carbohydrateG: base[0]!, proteinG: base[1]!, fatG: base[2]! };
}

/**
 * UX-16 read-only helper under each macro (`≈ 1,000 kcal · 50%`): the macro's energy and its share of the calorie
 * target, unrounded. `percent` is `null` when the calorie target isn't a positive number yet.
 */
export function macroEnergyShare(
  grams: number,
  macro: GoalMacroKey,
  calorieTargetKcal: number | null,
): { kcal: number; percent: number | null } {
  const kcal = grams * KCAL_PER_GRAM[macro];
  const percent =
    calorieTargetKcal !== null && Number.isFinite(calorieTargetKcal) && calorieTargetKcal > 0
      ? (kcal / calorieTargetKcal) * 100
      : null;
  return { kcal, percent };
}

export type GoalFieldKey = keyof NutritionTargets;

/** UX-00 range check on canonical targets; returns the invalid fields (empty = valid). */
export function invalidGoalFields(targets: NutritionTargets): GoalFieldKey[] {
  const bad: GoalFieldKey[] = [];
  const kcal = targets.calorieTargetKcal;
  if (!(Number.isFinite(kcal) && kcal >= GOAL_CALORIES_MIN_KCAL && kcal <= GOAL_CALORIES_MAX_KCAL)) {
    bad.push('calorieTargetKcal');
  }
  for (const key of ['carbohydrateTargetG', 'proteinTargetG', 'fatTargetG'] as const) {
    const g = targets[key];
    if (!(Number.isFinite(g) && g >= 0 && g <= GOAL_MACRO_MAX_G)) bad.push(key);
  }
  if (targets.macroTargetMode === 'percent') {
    const percentages = [targets.carbohydrateTargetPercent, targets.proteinTargetPercent, targets.fatTargetPercent];
    if (
      percentages.some(
        (value) => value === null || value === undefined || !Number.isFinite(value) || value < 0 || value > 100,
      ) ||
      Math.abs(percentages.reduce<number>((sum, value) => sum + (value ?? 0), 0) - 100) > 1e-7
    ) {
      for (const key of ['carbohydrateTargetG', 'proteinTargetG', 'fatTargetG'] as const) {
        if (!bad.includes(key)) bad.push(key);
      }
    }
  }
  return bad;
}

/** UX-16 Calories field: the valid whole-number range in the user's energy unit (500–10,000 kcal or 2,092–41,840 kJ). */
export function goalCaloriesRange(unit: EnergyUnit): { min: number; max: number } {
  // The epsilon keeps float noise from dropping an exact bound (see quickCaloriesRange).
  return {
    min: Math.ceil(energyFromKcal(GOAL_CALORIES_MIN_KCAL, unit) - 1e-9),
    max: Math.floor(energyFromKcal(GOAL_CALORIES_MAX_KCAL, unit) + 1e-9),
  };
}

/** UX-16: parses the Calories field (integer, energy unit) to canonical kcal; `null` when outside UX-00 ranges. */
export function parseGoalCalories(text: string, unit: EnergyUnit): number | null {
  const trimmed = text.trim();
  if (!/^\d{1,6}$/.test(trimmed)) return null;
  const value = Number(trimmed);
  const { min, max } = goalCaloriesRange(unit);
  return value >= min && value <= max ? energyToKcal(value, unit) : null;
}

/** UX-16: parses a macro goal field (integer grams, 0–1,000); `null` when invalid. */
export function parseGoalMacro(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d{1,4}$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return value <= GOAL_MACRO_MAX_G ? value : null;
}

/** UX-16 percentage mode: whole-number percentage from 0 to 100. */
export function parseGoalMacroPercent(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d{1,3}$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return value <= GOAL_MACRO_MAX_PERCENT ? value : null;
}
