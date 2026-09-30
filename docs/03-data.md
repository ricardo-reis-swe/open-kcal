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
- Catalog nutrients (DATA-20) are stored in their catalog unit (g / mg / µg).

## DATA-05 Nutrition snapshots
- A food entry stores name, brand, serving, kcal/macros and its catalog nutrient rows (DATA-20) **at save time**. Totals come from snapshots, never from `foods`.
- **Why:** history must not change when an API food updates, the cache refreshes, a custom food is edited/deleted, or a serving is renamed/removed.
- The entry must stay fully usable if `food_id` later becomes NULL.

## DATA-06 Unknown ≠ zero
- NULL nutrient = unknown; 0 = known zero. MUST NOT coerce NULL to 0 in API mapping or aggregation. The Diary UI shows the known sum (including `0`) plus an unknown indicator when `unknown count > 0`.
- Catalog nutrients follow the same rule by row: no row = unknown, a row with `0` = known zero (DATA-20).
- Quick Calories: macros and serving columns always NULL, and no nutrient rows. Use one consistent display name such as `Quick Calories`; user text goes in `note` (trimmed; empty → NULL).
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
| Add / edit food entry nutrients | Same transaction as the entry: snapshot every nutrient row the food has, scaled like kcal/macros (`amount × basis_multiplier × quantity`). An edit rewrites the rows whenever it recomputes kcal/macros; the snapshot-only fallback (UX-06) scales them proportionally. |
| Copy item / meal, Undo delete | Copy / reinsert the entry's nutrient rows with it. |
| Delete custom / saved food | Set `is_deleted = 1` (DATA-11). Triggered from Food Search (UX-04). |
| Create custom food | Tx: validate → insert `custom` food → insert ≥1 default serving. Does not create an entry. |
| Update goals | DATA-09. |

## DATA-17 Initialization and migrations
- First launch, one idempotent transaction: schema + indexes → settings row (locale-informed unit defaults, predictable fallback) → 4 default meals in display order → provisional goal row (UX-01; `goals_confirmed_at` NULL) → schema version. Repeated or interrupted launches MUST NOT duplicate anything.
- Migrations: numbered, forward-only, stored with the code. Each has an increasing integer version, runs in a transaction where possible, records its version only after all steps succeed, detects whether it already ran, and preserves user data.
- Migration 3 adds the macro target mode and percentage columns; existing goals remain fixed-gram goals.
- Migration 4 adds `food_nutrients`, `diary_entry_nutrients` (DATA-20) and the DATA-21 settings columns. Existing foods and entries get no rows (unknown); nothing is backfilled.
- Migration 5 adds DATA-23 `theme_preference`; existing installs get `system`.
- MUST NEVER recover from a failed migration by deleting/recreating the DB. A reset command may exist in dev builds only.
- Test each migration: from every supported prior version, with representative data, app startup afterwards, and rollback on failure where possible.

## DATA-18 Access boundary
- Screens/components MUST NOT run SQL. The data layer owns queries, transactions, row↔domain mapping, unit-independent (canonical) values, migrations and cache upserts. A separate credentials service owns secure storage.
- The application layer coordinates workflows (copy meal, delete meal). Presentation gets domain values + formatted data.

## DATA-19 Food Search sections setting
- UX-18 `Search results` is stored in `app_settings.food_search_sections TEXT NOT NULL DEFAULT '[{"id":"custom","visible":true},{"id":"saved","visible":true},{"id":"open_food_facts","visible":true},{"id":"usda","visible":true}]'`: a JSON array, in display order, of all 4 section ids, each with its visibility.
- Added by migration 2 (DATA-17), which updates `schema.sql` in the same change. Existing rows get the default.
- Read through Zod: exactly the 4 ids, each once, ≥1 visible. Invalid or unparseable data → the default (never a crash). The repository MUST reject writes that break these rules.

## DATA-20 Nutrient catalog and storage
- The catalog lives in code (`src/domain/nutrition/nutrientCatalog.ts`, source of truth for ids, units, groups, order and display decimals). Ids are stable strings, stored in SQLite; never rename one. Rows whose id isn't in the catalog are ignored on read.
- Catalog (group · id · unit), in display order:

| Group | Nutrients |
|---|---|
| `fatsSugars` | `fibre` g · `sugars` g · `added_sugars` g · `saturated_fat` g · `monounsaturated_fat` g · `polyunsaturated_fat` g · `trans_fat` g · `cholesterol` mg |
| `minerals` | `salt` g · `sodium` mg · `potassium` mg · `calcium` mg · `iron` mg · `magnesium` mg · `phosphorus` mg · `zinc` mg |
| `vitamins` | `vitamin_a` µg (RAE) · `vitamin_c` mg · `vitamin_d` µg · `vitamin_e` mg · `vitamin_k` µg · `thiamin` mg · `riboflavin` mg · `niacin` mg · `vitamin_b6` mg · `vitamin_b12` µg · `folate` µg (DFE) |
| `other` | `caffeine` mg |
- Out of the catalog: amino acids, individual fatty acids, alcohol. **Why:** USDA sends 100+ such rows for some foods; OFF reports alcohol in % vol, which can't be merged with grams.
- `food_nutrients(food_id → foods ON DELETE CASCADE, nutrient_id, amount REAL NOT NULL ≥ 0, PK(food_id, nutrient_id))`: per the food's basis (PROV-06), like its macros.
- `diary_entry_nutrients(entry_id → diary_entries ON DELETE CASCADE, nutrient_id, amount REAL NOT NULL ≥ 0, PK(entry_id, nutrient_id))`: the entry snapshot (DATA-05).
- Salt and sodium: when a source gives only one, store both, derived with `salt g = sodium mg × 2.5 ÷ 1000`.
- An external upsert (DATA-15) replaces the food's rows with the new response: a nutrient missing from it becomes unknown. Custom foods write the rows entered in UX-08.
- Day totals per nutrient = known sum + unknown count, where unknown count = the day's entries without a row for it (Quick Calories included):
```sql
SELECT n.nutrient_id, SUM(n.amount) AS known_sum, COUNT(*) AS known_count
FROM diary_entry_nutrients n JOIN diary_entries e ON e.id = n.entry_id
WHERE e.diary_date = ? GROUP BY n.nutrient_id;   -- unknown_count = entry_count − known_count
```
- No nutrient goals (SCOPE-10).

## DATA-21 Dashboard nutrients setting
- `app_settings.dashboard_nutrients TEXT NOT NULL`: a JSON array of `{ "id", "visible" }` in dashboard order, one per catalog id. Default: `fibre`, `sugars`, `saturated_fat`, `salt` visible, then the other catalog ids hidden in catalog order.
- Read through Zod. Tolerates catalog growth: unknown ids are dropped, duplicates keep the first, missing catalog ids are appended hidden. Unparseable → the default (never a crash). Zero visible is allowed (the Diary hides its chevron, DS-08).
- `app_settings.dashboard_nutrients_open INTEGER NOT NULL DEFAULT 0 CHECK (IN (0, 1))`: whether the Diary nutrient panel is open; toggling it saves immediately.
- Both added by migration 4 (DATA-17), which updates `schema.sql` in the same change.

## DATA-22 Widget refresh (UX-22, ARCH-23)
- The widget holds no data of its own; every redraw re-reads SQLite (ARCH-23). Freshness depends only on when a redraw runs.
- Redraw triggers:
  | Trigger | How | Staleness limit |
  |---|---|---|
  | Any successful app mutation | Global `MutationCache.onSuccess` in `query-client.ts` → `refreshWidget()`. Not per call site. | Immediate |
  | App startup after migrations + seed (DATA-17) | `refreshWidget()` once the DB is ready | Immediate |
  | Widget added / resized | Library event | Immediate |
  | Local midnight, time zone or locale change, app not opened | `updatePeriodMillis` (30 min) | ≤ 30 min while the device is awake |
- **Why global:** new write paths get widget refresh for free. The widget doesn't filter by date or kind. Unrelated writes (weight, settings) cause a harmless redraw.
- A dev-only seed (ARCH-18) goes through the same path.
- No exact alarms (no `SCHEDULE_EXACT_ALARM`) and no extra native broadcast receivers.

## DATA-23 Theme preference
- `app_settings.theme_preference TEXT NOT NULL DEFAULT 'system' CHECK (IN ('system', 'light', 'dark'))` (UX-23). An unexpected stored value reads as `system`.
- Read during startup, before the Router mounts (ARCH-17), so the app never shows the other scheme first. A failed read falls back to `system`. The widget reads it on every redraw (DS-14, ARCH-23).
