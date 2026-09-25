// Effective-dated nutrition goals (DATA-09, UX-01).
import { planGoalSave, type NutritionGoal, type NutritionTargets } from '@/domain/nutrition/goals';
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
};

const COLUMNS = 'id, effective_from, calorie_target_kcal, carbohydrate_target_g, protein_target_g, fat_target_g';

const toGoal = (r: GoalRow): NutritionGoal => ({
  id: r.id,
  effectiveFrom: r.effective_from,
  calorieTargetKcal: r.calorie_target_kcal,
  carbohydrateTargetG: r.carbohydrate_target_g,
  proteinTargetG: r.protein_target_g,
  fatTargetG: r.fat_target_g,
});

function validateTargets(t: NutritionTargets): void {
  const bad: string[] = [];
  if (!(Number.isFinite(t.calorieTargetKcal) && t.calorieTargetKcal > 0)) bad.push('calorieTargetKcal');
  for (const key of ['carbohydrateTargetG', 'proteinTargetG', 'fatTargetG'] as const) {
    if (!(Number.isFinite(t[key]) && t[key] >= 0)) bad.push(key);
  }
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
      validateTargets(targets);
      return db.transaction(async (tx) => {
        const now = nowUtcIso(clock);
        const today = todayLocal(clock);
        const settings = await readSettings(tx);
        const goals = (await tx.getAll<GoalRow>(`SELECT ${COLUMNS} FROM nutrition_goals`)).map(toGoal);
        const plan = planGoalSave(goals, today, settings.goalsConfirmedAt !== null);
        const values = [
          targets.calorieTargetKcal,
          targets.carbohydrateTargetG,
          targets.proteinTargetG,
          targets.fatTargetG,
        ];
        switch (plan.kind) {
          case 'updateInPlace':
            await tx.run(
              `UPDATE nutrition_goals SET calorie_target_kcal = ?, carbohydrate_target_g = ?, protein_target_g = ?,
                 fat_target_g = ?, updated_at = ? WHERE id = ?`,
              [...values, now, plan.goalId],
            );
            break;
          case 'upsertEffectiveToday':
            await tx.run(
              `INSERT INTO nutrition_goals (${COLUMNS}, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT (effective_from) DO UPDATE SET calorie_target_kcal = excluded.calorie_target_kcal,
                 carbohydrate_target_g = excluded.carbohydrate_target_g, protein_target_g = excluded.protein_target_g,
                 fat_target_g = excluded.fat_target_g, updated_at = excluded.updated_at`,
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
