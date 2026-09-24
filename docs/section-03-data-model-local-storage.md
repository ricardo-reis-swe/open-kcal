# Section 3 — Data Model and Local Storage

## Purpose

This section defines the MVP's local data model, persistence boundaries, relationships, integrity rules, and main database operations.

The model must support the approved product and navigation requirements without introducing accounts, cloud synchronization, or a backend. It must preserve diary history even when meals, foods, goals, units, or cached API data change later.

---

## Storage architecture

The app uses two storage systems with separate responsibilities.

### SQLite

SQLite is the source of truth for:

- App preferences that are not secrets.
- Nutrition goals.
- Configurable meals.
- Food records and serving options.
- Diary entries.
- Custom foods.
- Recent-food metadata.
- Cached USDA and Open Food Facts data.
- Weight history.
- Database schema version and migrations.

Foreign-key enforcement must be enabled for every database connection.

```sql
PRAGMA foreign_keys = ON;
```

Write operations that affect more than one record must run inside a transaction.

### Secure device storage

The USDA API key is stored in platform-provided secure storage, such as iOS Keychain and Android Keystore through a React Native-compatible secure-storage library.

The key must never be written to:

- SQLite.
- AsyncStorage.
- Application logs.
- Analytics or crash-report metadata.
- Cached API request records.

SQLite stores only non-secret USDA configuration state when useful, such as whether the user has completed configuration. Actual USDA availability should be verified against secure storage rather than inferred only from that flag.

---

## Data-model principles

### Stable identifiers

All user-created and locally materialized records use application-generated UUID strings. UI routes and relationships use these identifiers rather than names or list positions.

External foods also retain the identifier provided by their source. A USDA or Open Food Facts identifier is not used as the local primary key.

### Canonical storage units

Values are stored in stable canonical units and converted only for input and display:

- Body weight: kilograms.
- Food mass: grams.
- Volume: millilitres.
- Energy: kilocalories.
- Macronutrients: grams.

Changing a unit preference must never rewrite diary, food, goal, or weight-history records.

### Nutrition snapshots

Every food diary entry stores a snapshot of the food name, serving description, calories, and macros used when the entry was saved.

Diary totals are calculated from these snapshots, not from the current `foods` record. This prevents historical entries from changing when:

- An API source updates a food.
- A cached food is refreshed.
- A user edits or deletes a custom food.
- A serving option is renamed or removed.

### Unknown is different from zero

Nullable nutrition columns represent unknown values.

- `0` means the nutrient is known to be zero.
- `NULL` means the nutrient is not known.

Quick Calories entries always store `NULL` for protein, carbohydrate, and fat. Daily macro totals sum known values but must retain enough information for the UI to indicate that one or more entries have unknown macros.

---

## Entity relationship map

```text
nutrition_goals
       │
       │ selected by diary date
       ▼
   diary day
       │
       ├── diary_entries ────── meals
       │        │
       │        └────────────── foods ───── food_servings
       │                                  │
       │                                  └── food_cache_metadata
       │
       └── calculated totals

foods ───── recent_foods ───── meals (optional last-used meal)

app_settings ───── display units and goal weight

weight_entries ─── independent dated history
```

There is no separate `diary_days` table in the MVP. A diary day is derived from its local calendar date, the goal effective on that date, the configured meals, and entries recorded for that date. Empty dates therefore require no stored record.

---

## Core entities

### App settings

`app_settings` is a singleton row containing non-secret, app-wide preferences.

| Column | Type | Rules |
| --- | --- | --- |
| `id` | INTEGER | Primary key; always `1` |
| `weight_unit` | TEXT | `kg` or `lb` |
| `food_weight_unit` | TEXT | `g` or `oz` |
| `energy_unit` | TEXT | `kcal` or `kJ` |
| `volume_unit` | TEXT | `ml` or `fl_oz` |
| `goal_weight_kg` | REAL, nullable | Must be greater than zero when present |
| `created_at` | TEXT | UTC timestamp |
| `updated_at` | TEXT | UTC timestamp |

The initial row uses locale-informed defaults where reliable, with a predictable application fallback. The user can change every unit later.

### Nutrition goals

Nutrition goals are effective-dated so historical diary days retain the targets that applied at the time.

| Column | Type | Rules |
| --- | --- | --- |
| `id` | TEXT | UUID primary key |
| `effective_from` | TEXT | Unique local date in `YYYY-MM-DD` form |
| `calorie_target_kcal` | REAL | Greater than zero |
| `carbohydrate_target_g` | REAL | Zero or greater |
| `protein_target_g` | REAL | Zero or greater |
| `fat_target_g` | REAL | Zero or greater |
| `created_at` | TEXT | UTC timestamp |
| `updated_at` | TEXT | UTC timestamp |

The goal for a diary date is the record with the greatest `effective_from` value that is less than or equal to that date.

When the user changes goals, the default behavior is to create or replace the record effective today. Editing goals must not retroactively change older diary targets. A later planning section may define whether advanced users can choose a different effective date; the schema supports it without requiring that UI in the first release.

### Meals

Meals are records, not hard-coded categories.

| Column | Type | Rules |
| --- | --- | --- |
| `id` | TEXT | UUID primary key |
| `name` | TEXT | Trimmed, non-empty |
| `sort_order` | INTEGER | Zero or greater; unique among active meals |
| `created_at` | TEXT | UTC timestamp |
| `updated_at` | TEXT | UTC timestamp |

On first initialization, the app creates Breakfast, Lunch, Dinner, and Snacks as ordinary records. After creation they have no special behavior and may be renamed, reordered, or deleted.

Meal names do not need to be unique. Identity comes from `id`, although the UI may warn when creating visually ambiguous duplicates.

At least one meal must remain because all diary entries require a meal. A meal referenced by diary entries may be deleted only through a transaction that first reassigns those entries to another existing meal.

### Foods

The `foods` table provides one local representation for USDA, Open Food Facts, and custom foods.

| Column | Type | Rules |
| --- | --- | --- |
| `id` | TEXT | UUID primary key |
| `source` | TEXT | `custom`, `usda`, or `open_food_facts` |
| `external_id` | TEXT, nullable | Required for external sources; absent for custom foods |
| `name` | TEXT | Trimmed, non-empty |
| `brand` | TEXT, nullable | Optional |
| `basis_quantity` | REAL | Greater than zero |
| `basis_unit` | TEXT | Canonical `g`, `ml`, or source-defined count unit |
| `energy_kcal` | REAL | Zero or greater |
| `protein_g` | REAL, nullable | Zero or greater when known |
| `carbohydrate_g` | REAL, nullable | Zero or greater when known |
| `fat_g` | REAL, nullable | Zero or greater when known |
| `is_deleted` | INTEGER | Boolean soft-delete flag; default `0` |
| `created_at` | TEXT | UTC timestamp |
| `updated_at` | TEXT | UTC timestamp |

Nutrition columns describe the food's `basis_quantity` and `basis_unit`. For example, nutrition may be stored per 100 g, per 240 ml, or per one source-defined serving.

Custom foods require calories, protein, carbohydrates, and fat during creation, so their macro fields are non-null by application validation. External foods may have missing macro values and therefore use nullable columns.

The pair `(source, external_id)` must be unique when `external_id` is present. Re-fetching the same external food updates its local food record and cache metadata instead of creating duplicates.

Soft deletion applies primarily to custom foods. Deleted custom foods disappear from search and recent-food suggestions, while existing diary entries remain complete through their snapshots.

### Food serving options

`food_servings` defines the units the ruler can offer for a food.

| Column | Type | Rules |
| --- | --- | --- |
| `id` | TEXT | UUID primary key |
| `food_id` | TEXT | Foreign key to `foods.id`; cascade on food removal |
| `label` | TEXT | User-facing singular or neutral label, such as `egg`, `slice`, or `g` |
| `quantity` | REAL | Quantity represented by one unit; greater than zero |
| `unit` | TEXT | Unit code or source-defined count unit |
| `basis_multiplier` | REAL | Nutrition-basis multiplier for one displayed unit; greater than zero |
| `is_default` | INTEGER | Boolean; only one default per food |
| `sort_order` | INTEGER | Zero or greater within the food |

`basis_multiplier` converts one selected serving unit into the food's nutrition basis. If nutrition is stored per 100 g and one egg weighs 50 g, the egg option has a multiplier of `0.5`.

For a ruler value `q`, nutrition is calculated as:

```text
entry nutrient = food basis nutrient × serving basis_multiplier × q
```

Serving options must contain sufficient conversion data before they are offered in the UI. A label alone is not enough to make a unit selectable.

### Diary entries

One table represents both normal food entries and Quick Calories entries.

| Column | Type | Rules |
| --- | --- | --- |
| `id` | TEXT | UUID primary key |
| `entry_kind` | TEXT | `food` or `quick_calories` |
| `diary_date` | TEXT | Local date in `YYYY-MM-DD` form |
| `meal_id` | TEXT | Foreign key to `meals.id`; restrict deletion |
| `food_id` | TEXT, nullable | Foreign key to `foods.id`; set null if food is physically removed |
| `food_name_snapshot` | TEXT | Non-empty display name |
| `brand_snapshot` | TEXT, nullable | Brand at time of logging |
| `serving_quantity` | REAL, nullable | Greater than zero for normal food entries |
| `serving_unit_snapshot` | TEXT, nullable | Selected unit label/code |
| `energy_kcal` | REAL | Zero or greater |
| `protein_g` | REAL, nullable | Snapshot value |
| `carbohydrate_g` | REAL, nullable | Snapshot value |
| `fat_g` | REAL, nullable | Snapshot value |
| `note` | TEXT, nullable | Optional note; primarily used by Quick Calories |
| `sort_order` | INTEGER | Stable ordering within a meal and date |
| `created_at` | TEXT | UTC timestamp |
| `updated_at` | TEXT | UTC timestamp |

Normal food entries require `food_name_snapshot`, `serving_quantity`, and `serving_unit_snapshot`. They usually retain `food_id`, but their history must remain usable if that relationship later becomes null.

Quick Calories entries use a consistent display name such as `Quick Calories`, store the entered calorie value in `energy_kcal`, and keep serving and macro fields null. The optional user text is stored in `note`.

Entries belong to a meal through `meal_id`, including future diary entries. Moving an entry between meals updates only `meal_id` and `updated_at`; its nutrition snapshot remains unchanged.

### Weight entries

Weight history supports multiple measurements per day.

| Column | Type | Rules |
| --- | --- | --- |
| `id` | TEXT | UUID primary key |
| `measured_at` | TEXT | UTC timestamp representing the measurement instant |
| `local_date` | TEXT | Local date in `YYYY-MM-DD` form |
| `weight_kg` | REAL | Greater than zero |
| `created_at` | TEXT | UTC timestamp |
| `updated_at` | TEXT | UTC timestamp |

The current weight is the most recent record ordered by `measured_at`, with `created_at` as a deterministic tie-breaker. `local_date` makes date grouping stable and avoids repeated timezone conversion during history queries.

The Weight Entry sheet may initially expose only a date and value. In that case, new entries use the current local time when the selected date is today and a consistent local time, such as noon, for another date. The stored instant and local date must remain internally consistent.

### Recent foods

`recent_foods` contains one row per food and is updated only after a normal food entry is successfully saved.

| Column | Type | Rules |
| --- | --- | --- |
| `food_id` | TEXT | Primary key and foreign key to `foods.id`; cascade on removal |
| `last_used_at` | TEXT | UTC timestamp |
| `use_count` | INTEGER | One or greater |
| `last_serving_id` | TEXT, nullable | Foreign key to `food_servings.id`; set null on removal |
| `last_serving_quantity` | REAL, nullable | Last ruler value |
| `last_meal_id` | TEXT, nullable | Foreign key to `meals.id`; set null on meal removal |

Recent foods are ordered by `last_used_at` descending. The single-row-per-food design avoids duplicates while preserving frequency and last-used convenience data.

Quick Calories entries do not appear as recent foods.

### Food cache metadata

External food records use `food_cache_metadata` to track freshness and source payloads separately from normalized searchable data.

| Column | Type | Rules |
| --- | --- | --- |
| `food_id` | TEXT | Primary key and foreign key to `foods.id`; cascade on removal |
| `fetched_at` | TEXT | UTC timestamp |
| `expires_at` | TEXT | UTC timestamp |
| `raw_payload_json` | TEXT, nullable | Source response needed for reparsing or debugging |
| `schema_version` | INTEGER | Parser/cache format version |

Custom foods do not have cache metadata.

Expiration controls refresh behavior, not diary validity. An expired food may remain available offline and may still be logged from recents or cache. When network access is available, the app can refresh it before or after selection according to the food-search UX defined later.

Raw payloads must not contain request headers, authentication data, or the USDA API key.

---

## Dates, timezones, and timestamps

### Diary dates

Diary dates are calendar concepts and are stored as ISO local dates:

```text
YYYY-MM-DD
```

They are not stored as UTC midnight timestamps. Converting a diary date to UTC can shift it to the previous or next day and must be avoided.

Changing device timezone does not move an entry to another diary date. The saved `diary_date` remains authoritative.

### Event timestamps

Creation, update, cache, recent-use, and actual measurement timestamps are stored as UTC ISO-8601 strings with millisecond precision:

```text
2026-09-25T14:32:18.123Z
```

The app converts these timestamps to local time only for display.

### Goal effective dates

Nutrition goals use the same local-date representation as diary entries. This allows a simple indexed lookup and ensures that today's target does not shift after a timezone change.

---

## Unit conversion and numeric precision

SQLite `REAL` values are used for user-entered measurements and nutrient calculations. The application must keep full calculation precision in storage and round only for display.

Required conversion constants include:

```text
1 lb    = 0.45359237 kg
1 oz    = 28.349523125 g
1 fl oz = 29.5735295625 ml
1 kcal  = 4.184 kJ
```

The selected unit preference controls labels, input parsing, ruler presentation, and formatted output. It does not affect canonical stored values.

Calories and macros for a diary entry are calculated from the selected serving using unrounded source values and then stored as a snapshot. Daily totals sum stored snapshot values and are rounded once for display.

---

## Daily totals and unknown macros

Daily and meal totals are derived with aggregate queries over `diary_entries`.

Energy can always be summed because every entry requires `energy_kcal`.

Each macro needs two derived values:

- The sum of known values.
- Whether any included entry has an unknown value.

Conceptually:

```sql
SELECT
  SUM(energy_kcal) AS energy_kcal,
  SUM(protein_g) AS known_protein_g,
  SUM(CASE WHEN protein_g IS NULL THEN 1 ELSE 0 END) AS unknown_protein_count
FROM diary_entries
WHERE diary_date = ?;
```

The UI can therefore show the known macro total while also communicating that the day includes entries whose macros are unknown. It must not silently convert unknown macros to known zeroes.

---

## Search and cache behavior

Food Search combines results from three local or remote sources:

1. Active custom foods in SQLite.
2. Recent and valid cached external foods in SQLite.
3. Remote USDA and Open Food Facts searches when available.

The `foods` table should be indexed for normalized name and brand lookup. If the selected SQLite runtime includes FTS5, an FTS virtual table may be added for local food search. The normalized relational tables remain the source of truth.

Remote results are upserted into `foods`, `food_servings`, and `food_cache_metadata` before they are logged. This produces a stable local `food_id` and enables offline access later.

Search-result merging deduplicates external foods by `(source, external_id)`. Foods from different sources are not assumed to represent the same product even when their names and brands match.

---

## Integrity and deletion rules

### Meal deletion

A meal cannot be deleted while referenced by diary entries.

The user must choose a different existing target meal. One transaction then:

1. Updates every affected `diary_entries.meal_id`.
2. Clears or updates matching `recent_foods.last_meal_id` values.
3. Deletes the meal.
4. Compacts meal `sort_order` values.

If any step fails, the transaction rolls back completely.

The last remaining meal cannot be deleted.

### Custom-food deletion

Deleting a custom food sets `is_deleted = 1` so it no longer appears in search or recent suggestions. Existing diary entries continue to display their snapshots.

The app may permanently purge unreferenced soft-deleted foods during later maintenance, but physical cleanup is not required for the MVP.

### Diary-entry deletion

Deleting a diary entry physically removes that row after confirmation. Totals are derived, so no separate counters need correction. Recent-food use counts are historical usage metadata and are not decremented.

### Weight-entry deletion

Deleting a weight entry physically removes it after confirmation. Current weight is automatically recalculated as the newest remaining record.

### USDA key removal

Removing the USDA key affects only secure storage and USDA search availability. It must not delete cached USDA foods or diary history.

---

## Required indexes and constraints

The initial schema should include at least:

```text
UNIQUE nutrition_goals(effective_from)
UNIQUE foods(source, external_id) WHERE external_id IS NOT NULL
UNIQUE meals(sort_order)

INDEX nutrition_goals(effective_from DESC)
INDEX diary_entries(diary_date, meal_id, sort_order)
INDEX diary_entries(food_id)
INDEX foods(source, external_id)
INDEX foods(name)
INDEX food_servings(food_id, sort_order)
INDEX weight_entries(measured_at DESC)
INDEX weight_entries(local_date, measured_at DESC)
INDEX recent_foods(last_used_at DESC)
INDEX food_cache_metadata(expires_at)
```

Application validation should be backed by SQLite `CHECK` constraints wherever practical, especially for enums, booleans, positive quantities, and non-negative nutrition values.

Meal reordering should update all affected `sort_order` values in one transaction. A temporary out-of-range value or a two-phase ordering update may be used to avoid violating the unique constraint during swaps.

---

## Database initialization

On the first launch, one initialization transaction creates:

1. The schema and indexes.
2. The singleton app-settings row.
3. The four default meal records in display order.
4. The initial nutrition-goal record after the user supplies goals, or a clearly documented provisional default if onboarding permits postponement.
5. The initial schema-version record.

Initialization must be idempotent. An interrupted or repeated app launch must not duplicate default meals or settings.

---

## Schema migrations

The app uses numbered, forward-only migrations stored with the application code.

Each migration:

- Has a unique increasing integer version.
- Runs inside a transaction where supported by the operations involved.
- Records its successful version only after all steps complete.
- Can safely detect whether it has already run.
- Preserves user data.

A small metadata table tracks the current version:

| Column | Type | Rules |
| --- | --- | --- |
| `version` | INTEGER | Current schema version |
| `applied_at` | TEXT | UTC timestamp |

Production upgrades must never recover from migration failure by silently deleting and recreating the database. A database-reset command may exist for development builds only and must be inaccessible in normal production use.

Before shipping a migration, tests should cover:

- Migrating from every supported prior schema version.
- Running the migration against representative user data.
- Application startup after migration.
- Failure rollback when possible.

---

## Main data operations

### Load a diary day

1. Resolve the effective nutrition goal for the selected date.
2. Load meals ordered by `sort_order`.
3. Load entries for the date ordered by meal and entry `sort_order`.
4. Aggregate calorie and macro totals per meal and for the full day.
5. Return unknown-macro flags alongside known totals.

All configured meals appear even when they contain no entries.

### Add a normal food entry

In one transaction:

1. Validate the target meal, diary date, food, serving option, and quantity.
2. Calculate unrounded nutrition from the food and serving basis.
3. Insert the diary-entry snapshot.
4. Upsert the food's recent-food record.

The UI reloads derived totals after commit.

### Edit a normal food entry

1. Load the entry by stable ID.
2. Validate the new serving and meal.
3. Recalculate and replace its snapshot nutrition when the serving changes.
4. Update the recent-food record after a successful save.

Changing only the meal does not recalculate nutrition.

### Add or edit Quick Calories

Validate the meal, date, and non-negative calorie value. Store macro and serving columns as null. The optional note is trimmed; an empty result becomes null.

### Copy a meal

In one transaction:

1. Read every source entry for the source `meal_id` and date in display order.
2. Create new UUIDs for copied entries.
3. Preserve all nutrition and display snapshots exactly.
4. Assign the destination date and the same `meal_id`.
5. Append after existing destination entries using new `sort_order` values.

Copying never links the new records to the originals. Later edits are independent.

### Reorder meals

Update the complete meal ordering in one transaction and verify that every active meal ID appears exactly once.

### Delete a meal

Require a different target meal, then perform reassignment, recent-food cleanup, deletion, and order compaction in one transaction.

### Create a custom food

In one transaction:

1. Validate all required fields and nutrition values.
2. Insert the `custom` food.
3. Insert at least one default serving option.

Creating the food alone does not create a diary entry.

### Update weight

Convert the entered value from the selected display unit to kilograms, validate it, and insert or update the targeted weight record. The displayed current weight is then derived from the latest measurement.

### Update goals

Insert or replace the nutrition-goal row effective on the chosen date. Older rows remain unchanged. If a row already exists for that effective date, update it rather than creating an ambiguous duplicate.

---

## Data-access boundaries

Screens and UI components must not issue ad hoc SQL. A data-access layer owns:

- Queries and transactions.
- Row-to-domain-model mapping.
- Unit-independent values.
- Schema migrations.
- Cache upserts.
- Secure-storage access through a separate credentials service.

The application layer coordinates workflows such as meal copying and deletion. Presentation code receives domain values and formatted display data without needing to understand table layout.

This boundary keeps React Native UI code testable and makes a future storage implementation change possible without changing navigation contracts.

---

## Backup and sync boundary

Accounts, cloud synchronization, and cross-device merging are outside the MVP. The schema therefore does not include user IDs, server revision numbers, or synchronization state.

Application-generated UUIDs and explicit timestamps are still used because they prevent identifier collisions and leave room for a future migration. No current behavior should imply that cloud backup or sync exists.

---

## Acceptance criteria

The Section 3 model is satisfied when:

- Every approved MVP record can be stored locally without a backend.
- User-configurable meals are referenced by stable IDs and can be safely reordered or deleted.
- Historical diary nutrition cannot change because a food or cache record changes.
- Quick Calories macros remain unknown rather than becoming zero.
- Past diary dates resolve the goals effective on those dates.
- Weight history supports multiple measurements per day and unit conversion without rewriting stored values.
- USDA credentials exist only in secure device storage.
- External foods can be cached, refreshed, and used offline.
- Date handling does not shift diary entries across days when timezones change.
- Multi-record mutations are atomic and preserve data on failure.
- Schema upgrades preserve production user data.
