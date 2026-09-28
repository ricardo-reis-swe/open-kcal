// Effective-dated nutrition goals (DATA-09, UX-01).
import type { LocalDate } from '@/shared/dates';

export type NutritionTargets = {
  calorieTargetKcal: number;
  carbohydrateTargetG: number;
  proteinTargetG: number;
  fatTargetG: number;
};

export type NutritionGoal = NutritionTargets & { id: string; effectiveFrom: LocalDate };

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

/** UX-16 helper energy factors (4/4/9 kcal per g). */
export const KCAL_PER_GRAM = { carbohydrateG: 4, proteinG: 4, fatG: 9 } as const;

export type GoalMacroKey = keyof typeof KCAL_PER_GRAM;

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
  return bad;
}
