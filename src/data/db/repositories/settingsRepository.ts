// app_settings singleton (DATA-01, DATA-04). Non-secret preferences only; the USDA key never comes here.
import { z } from 'zod';

import {
  isValidFoodSearchSections,
  parseFoodSearchSections,
  type FoodSearchSections,
} from '@/domain/food/searchSections';
import type { UnitPreferences } from '@/domain/units/units';
import { isValidWeightKg } from '@/domain/weight/weight';
import { nowUtcIso, type UtcIso } from '@/shared/dates';
import { DatabaseError, ValidationError } from '@/shared/errors';

import type { SqlExecutor } from '../sql';
import type { RepositoryDeps } from './deps';

export type AppSettings = UnitPreferences & {
  goalWeightKg: number | null;
  goalsConfirmedAt: UtcIso | null;
};

// ARCH-03: validate the row so a corrupt or mismatched DB fails loudly instead of rendering garbage.
const settingsRow = z.object({
  weight_unit: z.enum(['kg', 'lb']),
  food_weight_unit: z.enum(['g', 'oz']),
  energy_unit: z.enum(['kcal', 'kJ']),
  volume_unit: z.enum(['ml', 'fl_oz']),
  goal_weight_kg: z.number().positive().nullable(),
  goals_confirmed_at: z.string().nullable(),
});

export async function readSettings(db: SqlExecutor): Promise<AppSettings> {
  const row = await db.getFirst('SELECT * FROM app_settings WHERE id = 1');
  const parsed = settingsRow.safeParse(row);
  if (!parsed.success) throw new DatabaseError('Settings row is missing or invalid');
  const r = parsed.data;
  return {
    weightUnit: r.weight_unit,
    foodWeightUnit: r.food_weight_unit,
    energyUnit: r.energy_unit,
    volumeUnit: r.volume_unit,
    goalWeightKg: r.goal_weight_kg,
    goalsConfirmedAt: r.goals_confirmed_at,
  };
}

export function createSettingsRepository({ db, clock }: RepositoryDeps) {
  return {
    get: () => readSettings(db),

    /** DATA-04: changing a unit only changes the preference; no stored record is rewritten. */
    async updateUnits(units: Partial<UnitPreferences>): Promise<AppSettings> {
      const current = await readSettings(db);
      const next = { ...current, ...units };
      await db.run(
        'UPDATE app_settings SET weight_unit = ?, food_weight_unit = ?, energy_unit = ?, volume_unit = ?, updated_at = ? WHERE id = 1',
        [next.weightUnit, next.foodWeightUnit, next.energyUnit, next.volumeUnit, nowUtcIso(clock)],
      );
      return readSettings(db);
    },

    /** DATA-19: invalid or unparseable stored data reads as the default order, all visible (never a crash). */
    async getFoodSearchSections(): Promise<FoodSearchSections> {
      const row = await db.getFirst<{ food_search_sections: unknown }>(
        'SELECT food_search_sections FROM app_settings WHERE id = 1',
      );
      return parseFoodSearchSections(row?.food_search_sections);
    },

    /** DATA-19: rejects anything but the 4 ids, each once, with ≥1 visible. */
    async setFoodSearchSections(sections: FoodSearchSections): Promise<FoodSearchSections> {
      if (!isValidFoodSearchSections(sections))
        throw new ValidationError('Invalid Food Search sections', ['foodSearchSections']);
      const json = JSON.stringify(sections.map(({ id, visible }) => ({ id, visible })));
      await db.run('UPDATE app_settings SET food_search_sections = ?, updated_at = ? WHERE id = 1', [
        json,
        nowUtcIso(clock),
      ]);
      return parseFoodSearchSections(json);
    },

    /** Canonical kg; `null` clears the goal (UX-18). */
    async setGoalWeightKg(kg: number | null): Promise<AppSettings> {
      if (kg !== null && !isValidWeightKg(kg))
        // UX-00 20–500 kg

        throw new ValidationError('Invalid goal weight', ['goalWeightKg']);
      await db.run('UPDATE app_settings SET goal_weight_kg = ?, updated_at = ? WHERE id = 1', [kg, nowUtcIso(clock)]);
      return readSettings(db);
    },
  };
}

export type SettingsRepository = ReturnType<typeof createSettingsRepository>;
