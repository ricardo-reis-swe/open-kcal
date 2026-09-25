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
