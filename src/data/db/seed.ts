// First-launch seed (DATA-17, DATA-10, UX-01). Idempotent: everything is keyed on inserting the settings singleton,
// so a repeated launch inserts nothing, and a fresh install runs it in the same transaction as the schema.
import { PROVISIONAL_TARGETS } from '@/domain/nutrition/goals';
import type { UnitPreferences } from '@/domain/units/units';
import type { LocalDate, UtcIso } from '@/shared/dates';

import type { IdGenerator } from './ids';
import type { SqlExecutor } from './sql';

export type SeedInput = {
  now: UtcIso;
  /** First-launch local date: the provisional goal is effective from it (UX-01). */
  today: LocalDate;
  /** Locale-informed defaults (DATA-17), e.g. `defaultUnitPreferences(measurementSystem)`. */
  units: UnitPreferences;
  /** Default meal names in display order, in the app language at first launch; never re-translated (DATA-10). */
  mealNames: readonly string[];
  ids: IdGenerator;
};

export type SeedResult = { seeded: boolean };

export async function seedDefaults(tx: SqlExecutor, input: SeedInput): Promise<SeedResult> {
  if (input.mealNames.length === 0) throw new RangeError('At least one default meal is required');
  const { changes } = await tx.run(
    `INSERT INTO app_settings
       (id, weight_unit, food_weight_unit, energy_unit, volume_unit, goal_weight_kg, goals_confirmed_at, created_at, updated_at)
     VALUES (1, ?, ?, ?, ?, NULL, NULL, ?, ?)
     ON CONFLICT (id) DO NOTHING`,
    [
      input.units.weightUnit,
      input.units.foodWeightUnit,
      input.units.energyUnit,
      input.units.volumeUnit,
      input.now,
      input.now,
    ],
  );
  if (changes === 0) return { seeded: false };

  for (const [index, name] of input.mealNames.entries()) {
    await tx.run('INSERT INTO meals (id, name, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', [
      input.ids.newId(),
      name,
      index,
      input.now,
      input.now,
    ]);
  }

  await tx.run(
    `INSERT INTO nutrition_goals
       (id, effective_from, calorie_target_kcal, carbohydrate_target_g, protein_target_g, fat_target_g, created_at, updated_at)
     SELECT ?, ?, ?, ?, ?, ?, ?, ?
     WHERE NOT EXISTS (SELECT 1 FROM nutrition_goals)`,
    [
      input.ids.newId(),
      input.today,
      PROVISIONAL_TARGETS.calorieTargetKcal,
      PROVISIONAL_TARGETS.carbohydrateTargetG,
      PROVISIONAL_TARGETS.proteinTargetG,
      PROVISIONAL_TARGETS.fatTargetG,
      input.now,
      input.now,
    ],
  );
  return { seeded: true };
}
