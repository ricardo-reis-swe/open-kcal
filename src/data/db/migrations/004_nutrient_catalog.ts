// Migration 4 (DATA-20, DATA-21, DATA-17): catalog nutrient rows for foods and entry snapshots, plus the dashboard
// nutrients setting. Existing foods/entries get no rows (unknown); nothing is backfilled. `schema/schema.sql` carries
// the same shape. Forward-only: never edit a shipped migration, add a new one.
import type { Migration } from './types';

/** DATA-21 stored default: the 4 visible nutrients; the reader appends every other catalog id hidden. */
export const DASHBOARD_NUTRIENTS_DEFAULT_SQL =
  '\'[{"id":"fibre","visible":true},{"id":"sugars","visible":true},{"id":"saturated_fat","visible":true},{"id":"salt","visible":true}]\'';

export const migration004: Migration = {
  version: 4,
  name: 'nutrient catalog',
  up: (tx) =>
    tx.exec(`
      CREATE TABLE food_nutrients (
        food_id     TEXT NOT NULL REFERENCES foods (id) ON DELETE CASCADE,
        nutrient_id TEXT NOT NULL,
        amount      REAL NOT NULL CHECK (amount >= 0),
        PRIMARY KEY (food_id, nutrient_id)
      ) WITHOUT ROWID;
      CREATE TABLE diary_entry_nutrients (
        entry_id    TEXT NOT NULL REFERENCES diary_entries (id) ON DELETE CASCADE,
        nutrient_id TEXT NOT NULL,
        amount      REAL NOT NULL CHECK (amount >= 0),
        PRIMARY KEY (entry_id, nutrient_id)
      ) WITHOUT ROWID;
      ALTER TABLE app_settings ADD COLUMN dashboard_nutrients TEXT NOT NULL DEFAULT ${DASHBOARD_NUTRIENTS_DEFAULT_SQL};
      ALTER TABLE app_settings
        ADD COLUMN dashboard_nutrients_open INTEGER NOT NULL DEFAULT 0 CHECK (dashboard_nutrients_open IN (0, 1));
    `),
};
