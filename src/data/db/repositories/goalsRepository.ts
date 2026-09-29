// Effective-dated nutrition goals (DATA-09, UX-01).
import {
  gramsFromMacroPercent,
  invalidGoalFields,
  planGoalSave,
  type NutritionGoal,
  type NutritionTargets,
} from '@/domain/nutrition/goals';
import { nowUtcIso, todayLocal, type LocalDate } from '@/shared/dates';
import { ValidationError } from '@/shared/errors';

import type { SqlExecutor } from '../sql';
import type { RepositoryDeps } from './deps';
import { readSettings } from './settingsRepository';

type GoalRow = {
  id: string;
  effective_from: string;
  calorie_target_kcal: number;
  carbohydrate_target_g: number;
  protein_target_g: number;
  fat_target_g: number;
  macro_target_mode: 'grams' | 'percent';
  carbohydrate_target_percent: number | null;
  protein_target_percent: number | null;
  fat_target_percent: number | null;
};

const COLUMNS = `id, effective_from, calorie_target_kcal, carbohydrate_target_g, protein_target_g, fat_target_g,
  macro_target_mode, carbohydrate_target_percent, protein_target_percent, fat_target_percent`;

const toGoal = (r: GoalRow): NutritionGoal => ({
  id: r.id,
  effectiveFrom: r.effective_from,
  calorieTargetKcal: r.calorie_target_kcal,
  carbohydrateTargetG: r.carbohydrate_target_g,
  proteinTargetG: r.protein_target_g,
  fatTargetG: r.fat_target_g,
  macroTargetMode: r.macro_target_mode,
  carbohydrateTargetPercent: r.carbohydrate_target_percent,
  proteinTargetPercent: r.protein_target_percent,
  fatTargetPercent: r.fat_target_percent,
});

/**
 * DATA-09: percentage mode stores the three percentages and derives the canonical gram targets from the calorie
 * target (4/4/9), so stored grams can never disagree with the percentages. Grams mode clears the percentages.
 */
function normalizedTargets(targets: NutritionTargets) {
  const mode = targets.macroTargetMode ?? 'grams';
  if (mode === 'grams') {
    return {
      ...targets,
      macroTargetMode: mode,
      carbohydrateTargetPercent: null,
      proteinTargetPercent: null,
      fatTargetPercent: null,
    };
  }
  const carbohydrateTargetPercent = targets.carbohydrateTargetPercent ?? null;
  const proteinTargetPercent = targets.proteinTargetPercent ?? null;
  const fatTargetPercent = targets.fatTargetPercent ?? null;
  const grams = (percent: number | null, macro: 'carbohydrateG' | 'proteinG' | 'fatG', fallback: number) =>
    percent === null ? fallback : gramsFromMacroPercent(targets.calorieTargetKcal, percent, macro);
  return {
    ...targets,
    macroTargetMode: mode,
    carbohydrateTargetPercent,
    proteinTargetPercent,
    fatTargetPercent,
    carbohydrateTargetG: grams(carbohydrateTargetPercent, 'carbohydrateG', targets.carbohydrateTargetG),
    proteinTargetG: grams(proteinTargetPercent, 'proteinG', targets.proteinTargetG),
    fatTargetG: grams(fatTargetPercent, 'fatG', targets.fatTargetG),
  };
}

function validateTargets(t: NutritionTargets): void {
  const bad = invalidGoalFields(t); // UX-00 ranges
  if (bad.length > 0) throw new ValidationError('Invalid goal targets', bad);
}

/** Goal for date D = greatest `effective_from ≤ D` (DATA-09). */
export async function readGoalFor(db: SqlExecutor, date: LocalDate): Promise<NutritionGoal | null> {
  const row = await db.getFirst<GoalRow>(
    `SELECT ${COLUMNS} FROM nutrition_goals WHERE effective_from <= ? ORDER BY effective_from DESC LIMIT 1`,
    [date],
  );
  return row ? toGoal(row) : null;
}

export function createGoalsRepository({ db, clock, ids }: RepositoryDeps) {
  return {
    goalFor: (date: LocalDate) => readGoalFor(db, date),

    async list(): Promise<NutritionGoal[]> {
      return (await db.getAll<GoalRow>(`SELECT ${COLUMNS} FROM nutrition_goals ORDER BY effective_from`)).map(toGoal);
    },

    /** UX-01: the Diary shows "Using default goals" while this is true. */
    async isProvisional(): Promise<boolean> {
      return (await readSettings(db)).goalsConfirmedAt === null;
    },

    /**
     * DATA-09: upsert the row effective today; older rows never change. UX-01: while provisional, the first save
     * updates the provisional row in place (keeping its `effective_from`) and confirms goals.
     */
    async save(targets: NutritionTargets): Promise<NutritionGoal> {
      const normalized = normalizedTargets(targets);
      validateTargets(normalized);
      return db.transaction(async (tx) => {
        const now = nowUtcIso(clock);
        const today = todayLocal(clock);
        const settings = await readSettings(tx);
        const goals = (await tx.getAll<GoalRow>(`SELECT ${COLUMNS} FROM nutrition_goals`)).map(toGoal);
        const plan = planGoalSave(goals, today, settings.goalsConfirmedAt !== null);
        const values = [
          normalized.calorieTargetKcal,
          normalized.carbohydrateTargetG,
          normalized.proteinTargetG,
          normalized.fatTargetG,
          normalized.macroTargetMode,
          normalized.carbohydrateTargetPercent,
          normalized.proteinTargetPercent,
          normalized.fatTargetPercent,
        ];
        switch (plan.kind) {
          case 'updateInPlace':
            await tx.run(
              `UPDATE nutrition_goals SET calorie_target_kcal = ?, carbohydrate_target_g = ?, protein_target_g = ?,
                 fat_target_g = ?, macro_target_mode = ?, carbohydrate_target_percent = ?,
                 protein_target_percent = ?, fat_target_percent = ?, updated_at = ? WHERE id = ?`,
              [...values, now, plan.goalId],
            );
            break;
          case 'upsertEffectiveToday':
            await tx.run(
              `INSERT INTO nutrition_goals (${COLUMNS}, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT (effective_from) DO UPDATE SET calorie_target_kcal = excluded.calorie_target_kcal,
                 carbohydrate_target_g = excluded.carbohydrate_target_g, protein_target_g = excluded.protein_target_g,
                 fat_target_g = excluded.fat_target_g, macro_target_mode = excluded.macro_target_mode,
                 carbohydrate_target_percent = excluded.carbohydrate_target_percent,
                 protein_target_percent = excluded.protein_target_percent,
                 fat_target_percent = excluded.fat_target_percent, updated_at = excluded.updated_at`,
              [ids.newId(), plan.effectiveFrom, ...values, now, now],
            );
            break;
        }
        if (settings.goalsConfirmedAt === null) {
          await tx.run('UPDATE app_settings SET goals_confirmed_at = ?, updated_at = ? WHERE id = 1', [now, now]);
        }
        const saved = await tx.getFirst<GoalRow>(`SELECT ${COLUMNS} FROM nutrition_goals WHERE effective_from = ?`, [
          plan.effectiveFrom,
        ]);
        return toGoal(saved!);
      });
    },
  };
}

export type GoalsRepository = ReturnType<typeof createGoalsRepository>;
