// Migration 2 (DATA-19, DATA-17): Food Search section order + visibility. `schema/schema.sql` carries the same column;
// existing settings rows get the default. Forward-only: never edit a shipped migration, add a new one.
import type { Migration } from './types';

export const FOOD_SEARCH_SECTIONS_DEFAULT_SQL =
  '\'[{"id":"custom","visible":true},{"id":"saved","visible":true},{"id":"open_food_facts","visible":true},{"id":"usda","visible":true}]\'';

export const migration002: Migration = {
  version: 2,
  name: 'food search sections',
  up: (tx) =>
    tx.exec(
      `ALTER TABLE app_settings ADD COLUMN food_search_sections TEXT NOT NULL DEFAULT ${FOOD_SEARCH_SECTIONS_DEFAULT_SQL}`,
    ),
};
