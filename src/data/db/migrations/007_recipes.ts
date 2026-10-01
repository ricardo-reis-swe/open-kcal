// Migration 7 (DATA-27): recipes. `foods.kind` marks a recipe (always `source = 'custom'`); `recipes` holds its
// servings and weights; `recipe_ingredients` its ingredient amounts. Existing foods become `kind = 'food'`.
// `schema/schema.sql` carries the same shape. Forward-only: never edit a shipped migration, add a new one.
import type { Migration } from './types';

export const migration007: Migration = {
  version: 7,
  name: 'recipes',
  up: (tx) =>
    tx.exec(`
      ALTER TABLE foods ADD COLUMN kind TEXT NOT NULL DEFAULT 'food' CHECK (kind IN ('food', 'recipe')) CHECK (kind = 'food' OR source = 'custom');
      CREATE TABLE recipes (
        food_id                TEXT PRIMARY KEY REFERENCES foods (id) ON DELETE CASCADE,
        servings_count         REAL NOT NULL CHECK (servings_count > 0),
        cooked_serving_g       REAL CHECK (cooked_serving_g IS NULL OR cooked_serving_g > 0),
        raw_serving_g_override REAL CHECK (raw_serving_g_override IS NULL OR raw_serving_g_override > 0)
      );
      CREATE TABLE recipe_ingredients (
        id                        TEXT PRIMARY KEY,
        recipe_id                 TEXT NOT NULL REFERENCES foods (id) ON DELETE CASCADE,
        food_id                   TEXT NOT NULL REFERENCES foods (id) ON DELETE RESTRICT,
        serving_id                TEXT REFERENCES food_servings (id) ON DELETE SET NULL,
        quantity                  REAL NOT NULL CHECK (quantity > 0),
        serving_unit_snapshot     TEXT NOT NULL,
        basis_multiplier_snapshot REAL NOT NULL CHECK (basis_multiplier_snapshot > 0),
        sort_order                INTEGER NOT NULL CHECK (sort_order >= 0)
      );
      CREATE INDEX idx_recipe_ingredients_recipe ON recipe_ingredients (recipe_id, sort_order);
      CREATE INDEX idx_recipe_ingredients_food ON recipe_ingredients (food_id);
    `),
};
