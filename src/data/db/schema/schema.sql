-- Reference schema v5 (DATA doc). Source of truth for table shape; migrations 1..n build it (v2: DATA-19 food_search_sections;
-- v3: DATA-09 macro target mode; v4: DATA-20 nutrient rows + DATA-21 dashboard nutrients; v5: DATA-23 theme preference).
-- Conventions: ids are app-generated UUID TEXT; *_at are UTC ISO-8601 with ms ("2026-09-25T14:32:18.123Z");
-- *_date / effective_from are local dates 'YYYY-MM-DD'. Canonical units: kg, g, ml, kcal. NULL nutrient = unknown, 0 = known zero.
-- Every connection: PRAGMA foreign_keys = ON; WAL where supported.

CREATE TABLE schema_version (
  version    INTEGER NOT NULL,
  applied_at TEXT    NOT NULL
);

-- Singleton, non-secret preferences. The USDA key is NEVER stored here (secure storage only).
CREATE TABLE app_settings (
  id                 INTEGER PRIMARY KEY CHECK (id = 1),
  weight_unit        TEXT NOT NULL CHECK (weight_unit IN ('kg', 'lb')),
  food_weight_unit   TEXT NOT NULL CHECK (food_weight_unit IN ('g', 'oz')),
  energy_unit        TEXT NOT NULL CHECK (energy_unit IN ('kcal', 'kJ')),
  volume_unit        TEXT NOT NULL CHECK (volume_unit IN ('ml', 'fl_oz')),
  goal_weight_kg     REAL CHECK (goal_weight_kg IS NULL OR goal_weight_kg > 0),
  goals_confirmed_at TEXT, -- NULL while goals are the provisional first-launch default (UX-01)
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL,
  food_search_sections TEXT NOT NULL DEFAULT '[{"id":"custom","visible":true},{"id":"saved","visible":true},{"id":"open_food_facts","visible":true},{"id":"usda","visible":true}]',
  dashboard_nutrients TEXT NOT NULL DEFAULT '[{"id":"fibre","visible":true},{"id":"sugars","visible":true},{"id":"saturated_fat","visible":true},{"id":"salt","visible":true}]',
  dashboard_nutrients_open INTEGER NOT NULL DEFAULT 0 CHECK (dashboard_nutrients_open IN (0, 1)),
  theme_preference   TEXT NOT NULL DEFAULT 'system' CHECK (theme_preference IN ('system', 'light', 'dark'))
);

-- Effective-dated. Goal for date D = row with greatest effective_from <= D.
CREATE TABLE nutrition_goals (
  id                    TEXT PRIMARY KEY,
  effective_from        TEXT NOT NULL UNIQUE,
  calorie_target_kcal   REAL NOT NULL CHECK (calorie_target_kcal > 0),
  carbohydrate_target_g REAL NOT NULL CHECK (carbohydrate_target_g >= 0),
  protein_target_g      REAL NOT NULL CHECK (protein_target_g >= 0),
  fat_target_g          REAL NOT NULL CHECK (fat_target_g >= 0),
  created_at            TEXT NOT NULL,
  updated_at            TEXT NOT NULL,
  macro_target_mode     TEXT NOT NULL DEFAULT 'grams' CHECK (macro_target_mode IN ('grams', 'percent')),
  carbohydrate_target_percent REAL CHECK (carbohydrate_target_percent IS NULL OR (carbohydrate_target_percent >= 0 AND carbohydrate_target_percent <= 100)),
  protein_target_percent REAL CHECK (protein_target_percent IS NULL OR (protein_target_percent >= 0 AND protein_target_percent <= 100)),
  fat_target_percent    REAL CHECK (fat_target_percent IS NULL OR (fat_target_percent >= 0 AND fat_target_percent <= 100))
);
CREATE INDEX idx_nutrition_goals_effective ON nutrition_goals (effective_from DESC);

-- Names need not be unique; identity is id. At least one meal must always exist.
CREATE TABLE meals (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL CHECK (length(trim(name)) > 0),
  sort_order INTEGER NOT NULL UNIQUE CHECK (sort_order >= 0), -- reorder via two-phase update (DATA-10)
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Nutrition values describe basis_quantity of basis_unit (e.g. per 100 g, per 240 ml, per 1 serving).
CREATE TABLE foods (
  id             TEXT PRIMARY KEY,
  source         TEXT NOT NULL CHECK (source IN ('custom', 'usda', 'open_food_facts')),
  external_id    TEXT,
  name           TEXT NOT NULL CHECK (length(trim(name)) > 0),
  brand          TEXT,
  basis_quantity REAL NOT NULL CHECK (basis_quantity > 0),
  basis_unit     TEXT NOT NULL, -- 'g', 'ml', or a source-defined count unit
  energy_kcal    REAL NOT NULL CHECK (energy_kcal >= 0),
  protein_g      REAL CHECK (protein_g IS NULL OR protein_g >= 0),
  carbohydrate_g REAL CHECK (carbohydrate_g IS NULL OR carbohydrate_g >= 0),
  fat_g          REAL CHECK (fat_g IS NULL OR fat_g >= 0),
  is_deleted     INTEGER NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1)),
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  CHECK ((source = 'custom') = (external_id IS NULL))
);
CREATE UNIQUE INDEX ux_foods_source_external ON foods (source, external_id) WHERE external_id IS NOT NULL;
CREATE INDEX idx_foods_source ON foods (source, external_id);
CREATE INDEX idx_foods_name ON foods (name);

-- A unit is offered in the ruler only if it has full conversion data.
-- entry nutrient = food basis nutrient * basis_multiplier * ruler value
CREATE TABLE food_servings (
  id               TEXT PRIMARY KEY,
  food_id          TEXT NOT NULL REFERENCES foods (id) ON DELETE CASCADE,
  label            TEXT NOT NULL, -- singular/neutral: 'egg', 'slice', 'g'
  quantity         REAL NOT NULL CHECK (quantity > 0),
  unit             TEXT NOT NULL,
  basis_multiplier REAL NOT NULL CHECK (basis_multiplier > 0), -- per 100 g basis, 50 g egg => 0.5
  is_default       INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
  sort_order       INTEGER NOT NULL CHECK (sort_order >= 0)
);
CREATE UNIQUE INDEX ux_food_servings_default ON food_servings (food_id) WHERE is_default = 1;
CREATE INDEX idx_food_servings_food ON food_servings (food_id, sort_order);

-- DATA-20 catalog nutrients per the food's basis, in the catalog unit. No row = unknown, 0 = known zero.
CREATE TABLE food_nutrients (
  food_id     TEXT NOT NULL REFERENCES foods (id) ON DELETE CASCADE,
  nutrient_id TEXT NOT NULL,
  amount      REAL NOT NULL CHECK (amount >= 0),
  PRIMARY KEY (food_id, nutrient_id)
) WITHOUT ROWID;

-- Food entries and Quick Calories entries. Totals are computed from these snapshots, never from foods.
CREATE TABLE diary_entries (
  id                    TEXT PRIMARY KEY,
  entry_kind            TEXT NOT NULL CHECK (entry_kind IN ('food', 'quick_calories')),
  diary_date            TEXT NOT NULL,
  meal_id               TEXT NOT NULL REFERENCES meals (id) ON DELETE RESTRICT,
  food_id               TEXT REFERENCES foods (id) ON DELETE SET NULL,
  food_name_snapshot    TEXT NOT NULL CHECK (length(food_name_snapshot) > 0),
  brand_snapshot        TEXT,
  serving_quantity      REAL CHECK (serving_quantity IS NULL OR serving_quantity > 0),
  serving_unit_snapshot TEXT,
  energy_kcal           REAL NOT NULL CHECK (energy_kcal >= 0),
  protein_g             REAL CHECK (protein_g IS NULL OR protein_g >= 0),
  carbohydrate_g        REAL CHECK (carbohydrate_g IS NULL OR carbohydrate_g >= 0),
  fat_g                 REAL CHECK (fat_g IS NULL OR fat_g >= 0),
  note                  TEXT,
  sort_order            INTEGER NOT NULL CHECK (sort_order >= 0),
  created_at            TEXT NOT NULL,
  updated_at            TEXT NOT NULL,
  CHECK (entry_kind <> 'food' OR (serving_quantity IS NOT NULL AND serving_unit_snapshot IS NOT NULL)),
  CHECK (entry_kind <> 'quick_calories' OR (serving_quantity IS NULL AND serving_unit_snapshot IS NULL
         AND protein_g IS NULL AND carbohydrate_g IS NULL AND fat_g IS NULL))
);
CREATE INDEX idx_diary_entries_day ON diary_entries (diary_date, meal_id, sort_order);
CREATE INDEX idx_diary_entries_food ON diary_entries (food_id);

-- DATA-20 entry snapshot of catalog nutrients (DATA-05). Deleted with its entry.
CREATE TABLE diary_entry_nutrients (
  entry_id    TEXT NOT NULL REFERENCES diary_entries (id) ON DELETE CASCADE,
  nutrient_id TEXT NOT NULL,
  amount      REAL NOT NULL CHECK (amount >= 0),
  PRIMARY KEY (entry_id, nutrient_id)
) WITHOUT ROWID;

-- Multiple measurements per day allowed. Current weight = latest measured_at, tie-break created_at.
CREATE TABLE weight_entries (
  id          TEXT PRIMARY KEY,
  measured_at TEXT NOT NULL,
  local_date  TEXT NOT NULL,
  weight_kg   REAL NOT NULL CHECK (weight_kg > 0),
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE INDEX idx_weight_measured ON weight_entries (measured_at DESC);
CREATE INDEX idx_weight_local_date ON weight_entries (local_date, measured_at DESC);

-- One row per food; updated only after a food entry is saved. Quick Calories never appear here.
CREATE TABLE recent_foods (
  food_id               TEXT PRIMARY KEY REFERENCES foods (id) ON DELETE CASCADE,
  last_used_at          TEXT NOT NULL,
  use_count             INTEGER NOT NULL CHECK (use_count >= 1),
  last_serving_id       TEXT REFERENCES food_servings (id) ON DELETE SET NULL,
  last_serving_quantity REAL,
  last_meal_id          TEXT REFERENCES meals (id) ON DELETE SET NULL
);
CREATE INDEX idx_recent_foods_last_used ON recent_foods (last_used_at DESC);

-- External foods only. Expiry controls refresh, not validity (expired foods stay usable offline).
-- raw_payload_json MUST NOT contain request headers, auth data or the USDA key.
CREATE TABLE food_cache_metadata (
  food_id          TEXT PRIMARY KEY REFERENCES foods (id) ON DELETE CASCADE,
  fetched_at       TEXT NOT NULL,
  expires_at       TEXT NOT NULL,
  raw_payload_json TEXT,
  schema_version   INTEGER NOT NULL
);
CREATE INDEX idx_food_cache_expires ON food_cache_metadata (expires_at);
