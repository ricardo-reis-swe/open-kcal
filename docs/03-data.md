# 03 Data (DATA)

Read when: touching SQLite, repositories, migrations, nutrition math, dates or secure storage. Table shape, constraints and indexes: `src/data/db/schema/schema.sql` (source of truth). This doc holds the behavioral rules the DDL can't express.

## DATA-01 Storage split
- **SQLite** is the source of truth for: non-secret preferences, goals, meals, foods + servings, diary entries, custom foods, recents, USDA/OFF cache, weight history, schema version.
- `PRAGMA foreign_keys = ON` on every connection. Any write touching more than one row runs in a transaction.
- **Secure storage** (Keychain/Keystore via `expo-secure-store`) holds only the USDA API key. The key MUST NEVER be written to SQLite, AsyncStorage, logs, analytics/crash metadata or cached request records.
- SQLite may keep a non-secret "USDA configured" flag, but availability MUST be checked against secure storage.

## DATA-02 No backend, no sync
- No user IDs, server revisions or sync state. UUIDs and timestamps are kept so a future migration stays possible. Nothing may imply backup/sync exists.

## DATA-03 Identifiers
- All local records use app-generated UUID strings. Routes and relations use IDs, never names or list positions.
- External foods keep their source ID in `external_id`; it is never the local PK.

## DATA-04 Canonical units
- Stored in kg / g / ml / kcal; macros in g. Convert only for input and display.
- Changing a unit preference MUST NOT rewrite diary, food, goal or weight records.
- Constants: `1 lb = 0.45359237 kg` · `1 oz = 28.349523125 g` · `1 fl oz = 29.5735295625 ml` · `1 kcal = 4.184 kJ`.
- Keep full precision in storage and calculations; round only for display. Entry nutrition is computed from unrounded values and then snapshotted. Day totals sum snapshots and round once.

## DATA-05 Nutrition snapshots
- A food entry stores name, brand, serving and kcal/macros **at save time**. Totals come from snapshots, never from `foods`.
- **Why:** history must not change when an API food updates, the cache refreshes, a custom food is edited/deleted, or a serving is renamed/removed.
- The entry must stay fully usable if `food_id` later becomes NULL.

## DATA-06 Unknown ≠ zero
- NULL nutrient = unknown; 0 = known zero. MUST NOT coerce NULL to 0 anywhere (API mapping, aggregation, UI).
- Quick Calories: macros and serving columns always NULL. Use one consistent display name such as `Quick Calories`; user text goes in `note` (trimmed; empty → NULL).
- Per macro, aggregates return **known sum + unknown count**:
```sql
SELECT SUM(energy_kcal) AS energy_kcal,
       SUM(protein_g) AS known_protein_g,
       SUM(CASE WHEN protein_g IS NULL THEN 1 ELSE 0 END) AS unknown_protein_count
FROM diary_entries WHERE diary_date = ?;
```

## DATA-07 Derived diary day
- There is no `diary_days` table. A day = local date + effective goal + meals + that date's entries. Empty days store nothing.

## DATA-08 Dates and time
- Diary dates and `effective_from` are local `YYYY-MM-DD`. NEVER store them as UTC midnight (that shifts the day).
- Changing the device timezone never moves an entry; the saved `diary_date` wins.
- Event timestamps (`*_at`) are UTC ISO-8601 with ms, converted to local only for display.

## DATA-09 Goals
- Goal for date D = the row with the greatest `effective_from ≤ D`.
- Saving goals upserts the row effective **today** (updates it if it already exists). Older rows are never changed, so past days keep their targets.
- The schema supports other effective dates. A later section may add a UI for choosing one; it is not required in the first release.

## DATA-10 Meals
- Seeded Breakfast, Lunch, Dinner, Snacks as ordinary records with no special behavior.
- Names may repeat (the UI may warn about ambiguous duplicates). At least one meal must always exist.
- Reorder: one transaction; verify every meal ID appears exactly once. SQLite can't defer UNIQUE, so use a two-phase update (e.g. temporary large positive values, since `sort_order ≥ 0`).
- Delete (one transaction, full rollback on failure): user picks a different target meal → reassign all `diary_entries.meal_id` → clear/update matching `recent_foods.last_meal_id` → delete the meal → compact `sort_order`. The last meal can't be deleted.

## DATA-11 Foods and servings
- Custom foods: all macros required by app validation (non-null in practice). External foods may have NULL macros.
- `(source, external_id)` is unique. Re-fetching updates the existing row + cache metadata; never duplicate.
- Delete custom food = `is_deleted = 1`. It disappears from search and recents; entries keep their snapshots. Unreferenced soft-deleted foods may be purged in later maintenance; not required for the MVP.
- A serving is selectable only with full conversion data; a label alone is not enough. Formula: `nutrient = basis nutrient × basis_multiplier × ruler value`.

## DATA-12 Diary entries
- Food entries require name snapshot, `serving_quantity` and `serving_unit_snapshot`.
- Moving an entry to another meal changes only `meal_id` + `updated_at`; nutrition is not recalculated.
- Delete removes the row physically (after UI confirmation). Totals are derived; recent `use_count` is not decremented.

## DATA-13 Weight
- Multiple measurements per day. Current weight = latest `measured_at`, tie-break `created_at`.
- A sheet that only collects a date: use the current local time if the date is today, otherwise a fixed local time (noon). `measured_at` and `local_date` MUST agree.
- Delete is physical; current weight recomputes.
- Input: convert from the display unit to kg, validate, then insert or update.

## DATA-14 Recents
- Upserted only after a successful **food** entry save (add or edit). Ordered by `last_used_at` DESC. Quick Calories excluded.

## DATA-15 Search and cache
- Sources: (1) active custom foods, (2) recent and valid cached external foods, (3) remote USDA/OFF when available.
- Index normalized name and brand for lookup. FTS5 is optional if the runtime has it; relational tables stay the source of truth.
- Remote results are upserted into `foods` + `food_servings` + `food_cache_metadata` **before** logging, which gives a stable local `food_id` and offline reuse.
- Dedupe only by `(source, external_id)`. Same-looking foods from different sources are not merged.
- Expired cache stays loggable offline; refresh when online (before or after selection, per `06-screens.md`).
- Removing the USDA key touches only secure storage + availability. Cached USDA foods and history stay.

## DATA-16 Operations
| Operation | Rules |
|---|---|
| Load day | Effective goal → meals by `sort_order` (all shown, even empty) → entries by meal + `sort_order` → per-meal and per-day totals with unknown flags. |
| Add food entry | Tx: validate meal/date/food/serving/qty → compute unrounded nutrition → insert snapshot → upsert recent. UI reloads after commit. |
| Edit food entry | Load by ID → validate serving/meal → recompute snapshot only if serving changed → upsert recent after save. |
| Add/edit Quick Calories | Validate meal, date, kcal ≥ 0. Macros + serving NULL. Trim note. |
| Copy meal | Tx: read source meal + date entries in order → new UUIDs → copy snapshots exactly → destination date, same `meal_id` → append after existing `sort_order`. Copies are independent of the originals. |
| Create custom food | Tx: validate → insert `custom` food → insert ≥1 default serving. Does not create an entry. |
| Update goals | DATA-09. |

## DATA-17 Initialization and migrations
- First launch, one idempotent transaction: schema + indexes → settings row (locale-informed unit defaults, predictable fallback) → 4 default meals in display order → initial goal row (the user's goals, or a documented provisional default; see `06-screens.md`) → schema version. Repeated or interrupted launches MUST NOT duplicate anything.
- Migrations: numbered, forward-only, stored with the code. Each has an increasing integer version, runs in a transaction where possible, records its version only after all steps succeed, detects whether it already ran, and preserves user data.
- MUST NEVER recover from a failed migration by deleting/recreating the DB. A reset command may exist in dev builds only.
- Test each migration: from every supported prior version, with representative data, app startup afterwards, and rollback on failure where possible.

## DATA-18 Access boundary
- Screens/components MUST NOT run SQL. The data layer owns queries, transactions, row↔domain mapping, unit-independent (canonical) values, migrations and cache upserts. A separate credentials service owns secure storage.
- The application layer coordinates workflows (copy meal, delete meal). Presentation gets domain values + formatted data.
