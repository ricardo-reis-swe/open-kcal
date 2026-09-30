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
- NULL nutrient = unknown; 0 = known zero. MUST NOT coerce NULL to 0 in API mapping or aggregation. The Diary UI shows the known sum (including `0`) plus an unknown indicator when `unknown count > 0`.
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
- **Exception (UX-01):** while `app_settings.goals_confirmed_at` is NULL, the first save updates the provisional row in place (keeping its `effective_from`) and sets `goals_confirmed_at`.
- Macro targets persist both their entry mode (`grams` or `percent`) and canonical gram targets. Percentage mode also persists the three percentages, which MUST total 100; canonical grams are derived from the calorie target using 4/4/9 kcal per gram.
- The schema supports other effective dates. A later section may add a UI for choosing one; it is not required in the first release.

## DATA-10 Meals
- Seeded Breakfast, Lunch, Dinner, Snacks as ordinary records with no special behavior. Names are written in the app language at first launch (pt-PT: `Pequeno-almoço`, `Almoço`, `Jantar`, `Lanches`) and never re-translated.
- Names may repeat (the UI may warn about ambiguous duplicates). At least one meal must always exist.
- Reorder: one transaction; verify every meal ID appears exactly once. SQLite can't defer UNIQUE, so use a two-phase update (e.g. temporary large positive values, since `sort_order ≥ 0`).
- Delete (one transaction, full rollback on failure): user picks a different target meal → reassign all `diary_entries.meal_id` → clear/update matching `recent_foods.last_meal_id` → delete the meal → compact `sort_order`. The last meal can't be deleted.

## DATA-11 Foods and servings
- Custom and external foods MAY have NULL macros; NULL means unknown, never zero (DATA-06).
- `(source, external_id)` is unique. Re-fetching updates the existing row + cache metadata; never duplicate.
- Delete custom or saved external food = `is_deleted = 1`. It disappears from search and recents; entries keep their snapshots. Undo sets `is_deleted = 0` without changing servings or history. Re-selecting a deleted external food from its provider upserts it with `is_deleted = 0`. Unreferenced soft-deleted foods may be purged in later maintenance; not required for the MVP.
- A serving is selectable only with full conversion data; a label alone is not enough. Formula: `nutrient = basis nutrient × basis_multiplier × ruler value`.

## DATA-12 Diary entries
- Food entries require name snapshot, `serving_quantity` and `serving_unit_snapshot`.
- Moving an entry to another meal changes only `meal_id` + `updated_at`; nutrition is not recalculated.
- Delete removes the row physically after the revealed Delete tap (UX-02). Totals are derived; recent `use_count` is not decremented. While the Undo toast is visible, Undo reinserts the exact entry snapshot with its original ID and `sort_order`; it does not update recents.

## DATA-13 Weight
- Multiple measurements per day. Current weight = latest `measured_at`, tie-break `created_at`.
- A sheet that only collects a date: use the current local time if the date is today, otherwise a fixed local time (noon). `measured_at` and `local_date` MUST agree.
- Delete is physical; current weight recomputes.
- Input: convert from the display unit to kg, validate, then insert or update. `local_date` ≤ today.

## DATA-14 Recents
- Upserted only after a successful **food** entry save (add or edit). Ordered by `last_used_at` DESC. Quick Calories excluded. The Recents list is capped at 20; Food Detail looks up a food's own record directly to restore its last serving (UX-05).

## DATA-15 Search and cache
- Sources: (1) active custom foods, (2) recent and valid cached external foods, (3) remote USDA/OFF when available.
- Index name and brand for lookup (no normalized search column, PROV-08). FTS5 is optional if the runtime has it; relational tables stay the source of truth.
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
| Add/edit Quick Calories | Validate meal, date, kcal ≥ 0 (the UI requires ≥ 1, UX-07). Macros + serving NULL. Trim note. |
| Copy item / meal | Tx: read the source entry or source meal/date entries in order → new UUID(s) → copy snapshots exactly → chosen destination date + meal → append after existing `sort_order`. Copies are independent of the originals. |
| Delete custom / saved food | Set `is_deleted = 1` (DATA-11). Triggered from Food Search (UX-04). |
| Create custom food | Tx: validate → insert `custom` food → insert ≥1 default serving. Does not create an entry. |
| Update goals | DATA-09. |

## DATA-17 Initialization and migrations
- First launch, one idempotent transaction: schema + indexes → settings row (locale-informed unit defaults, predictable fallback) → 4 default meals in display order → provisional goal row (UX-01; `goals_confirmed_at` NULL) → schema version. Repeated or interrupted launches MUST NOT duplicate anything.
- Migrations: numbered, forward-only, stored with the code. Each has an increasing integer version, runs in a transaction where possible, records its version only after all steps succeed, detects whether it already ran, and preserves user data.
- Migration 3 adds the macro target mode and percentage columns; existing goals remain fixed-gram goals.
- MUST NEVER recover from a failed migration by deleting/recreating the DB. A reset command may exist in dev builds only.
- Test each migration: from every supported prior version, with representative data, app startup afterwards, and rollback on failure where possible.

## DATA-18 Access boundary
- Screens/components MUST NOT run SQL. The data layer owns queries, transactions, row↔domain mapping, unit-independent (canonical) values, migrations and cache upserts. A separate credentials service owns secure storage.
- The application layer coordinates workflows (copy meal, delete meal). Presentation gets domain values + formatted data.

## DATA-19 Food Search sections setting
- UX-18 `Search results` is stored in `app_settings.food_search_sections TEXT NOT NULL DEFAULT '[{"id":"custom","visible":true},{"id":"saved","visible":true},{"id":"open_food_facts","visible":true},{"id":"usda","visible":true}]'`: a JSON array, in display order, of all 4 section ids, each with its visibility.
- Added by migration 2 (DATA-17), which updates `schema.sql` in the same change. Existing rows get the default.
- Read through Zod: exactly the 4 ids, each once, ≥1 visible. Invalid or unparseable data → the default (never a crash). The repository MUST reject writes that break these rules.
