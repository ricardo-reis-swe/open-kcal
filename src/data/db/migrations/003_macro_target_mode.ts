// Migration 3 (DATA-09, DATA-17): persist whether macro goals were entered as fixed grams or percentages.
// Existing goals remain fixed-gram goals. Forward-only: never edit a shipped migration, add a new one.
import type { Migration } from './types';

export const migration003: Migration = {
  version: 3,
  name: 'macro target mode',
  up: (tx) =>
    tx.exec(`
      ALTER TABLE nutrition_goals
        ADD COLUMN macro_target_mode TEXT NOT NULL DEFAULT 'grams' CHECK (macro_target_mode IN ('grams', 'percent'));
      ALTER TABLE nutrition_goals
        ADD COLUMN carbohydrate_target_percent REAL CHECK (carbohydrate_target_percent IS NULL OR (carbohydrate_target_percent >= 0 AND carbohydrate_target_percent <= 100));
      ALTER TABLE nutrition_goals
        ADD COLUMN protein_target_percent REAL CHECK (protein_target_percent IS NULL OR (protein_target_percent >= 0 AND protein_target_percent <= 100));
      ALTER TABLE nutrition_goals
        ADD COLUMN fat_target_percent REAL CHECK (fat_target_percent IS NULL OR (fat_target_percent >= 0 AND fat_target_percent <= 100));
    `),
};
