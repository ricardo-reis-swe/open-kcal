# Progress log (ROAD-03)

Single place for implementation status. Updated in the same commit as the work it describes. Accepted milestones' sections are in [progress-archive.md](progress-archive.md).

| Milestone | Status |
|---|---|
| M0 Skeleton | done |
| M1 Data + domain | done |
| M2 Diary (read) | done |
| M3 Quick Calories | done |
| M4 Custom foods + ruler | done |
| M5 Search + Open Food Facts | done |
| M6 USDA | done |
| M7 Dashboard copy | done |
| M8 Profile | done |
| M9 Hardening | awaiting user acceptance |
| Nutrient details (user-requested) | awaiting user device check |
| Barcode scanning (user-requested) | in progress |

Spec changes: 2026-09-30 (user-requested) themes back: DS-03 light + dark, new UX-23 Theme screen (`System | Light | Dark`, default System) from a Profile `APP › Theme` row (UX-15, NAV-06), DATA-23 `theme_preference` (migration 5), the widget follows the theme too (DS-14: both versions on `System`). Needs a native rebuild (`userInterfaceStyle: automatic`); not checked on a device. 2026-09-28 DS-13 reduced to light theme · iOS + Android · one phone size · default text; the matrix moved to POST-13. ROAD-03: one-line task entries, accepted milestones archived. 2026-09-28 (user-requested, commit below "feat(diary): scrollable date strip") UX-02 date strip is a windowed horizontal scroll of day buttons that re-centers on every selection change; scrolling it never changes the day (`DiaryDateStrip.tsx`, `dateStripWindow.ts`, tests `DiaryDateStrip.test.tsx`/`dateStripWindow.test.ts`; `m2-swipe-date` PASS Android + iOS, `m2-launch-today` PASS iOS, Android fails only at `Lunch, .*` because the emulator's Lunch meal was deleted in the M8 by-hand review; strip scroll then page swipe re-centered checked by hand on Android).

2026-09-28 (user-requested): removed Diary page swiping and Meal Detail; added overview previous/next chevrons, Dashboard entry/meal `…` actions, swipe-delete entries, date-then-meal item/meal copy, USDA Search results gating until a key exists, and keyboard-hidden bottom navigation. Meal headers no longer have leading circle markers.

2026-09-29 review fixes for `d786ee8`: copy results and delete failures use the transient DS-10 toast (no persistent status above a meal); a failed swipe-delete springs the row back (Diary + Food Search); Undo keeps the entry's original timestamps (DATA-12); percentage goals derive canonical grams in the repository (DATA-09); Maestro `m2-swipe-date` → `m2-change-date` (chevrons, swipe no longer pages) and `m4-custom-food` swipe-delete without a second tap; UX-03 kept as a removed stub; ARCH-20 note + pinned `@legendapp/list`; removed unused `formatLongDate` and the stale `codex-next-prompt.md`. **Maestro flows not yet run on devices.**

2026-09-28 E2E flow fixes (ARCH-18): `m2-launch-today` independent of meal state; `m4-custom-food` no `hideKeyboard` (Serving sheet `avoidKeyboard` keeps Done above the iOS decimal pad); `m5-offline-foods` seeds its own data; `m5-offline-local-foods` uses a dev-only seed deep link (`devSeedLink.ts`, `+native-intent.tsx`) with the normal Metro, replacing `scripts/e2e-m5-offline-android.sh`; USDA key-missing no longer logged as a provider failure (PROV-12); Meals drop index clamped to the list when a drag ends over the app bar (UX-17). `npm run check` green (79 suites / 515 tests). **Not yet run on devices**: those 4 flows (Android) + `m4-custom-food` (iOS); verify in M9. Known gap: `m8-weight` native SIGSEGV on Android launch seen once, not reproduced.

2026-09-28 (user-approved, commit "feat(food-search): separate provider sections, 10 per page") UX-04/PROV-08: reverted the merged `Online` list (4a3df52) to separate `Open Food Facts` and `USDA` sections, each with its own `Show more` and inline status (OFF now also shows its busy state); remote page size 10 (cap 5 pages = 50 per section); kept `keyboardShouldPersistTaps`, the `food-search-create-custom` testID and the m4 top-action tap (`FoodSearchScreen.tsx`, `usda/client.ts`, `open-food-facts/client.ts`; tests `FoodSearchScreen.test.tsx`, client tests); live Android `egg` checked.

2026-09-28 (user-approved, commit "docs(spec): Food Search section order and visibility") SCOPE-01/UX-18/UX-04/DATA-19/ROAD-01/ROAD-02: new MVP feature for M9, reorder and show/hide the 4 Food Search sections on Food Databases (spec only; migration 2 + `schema.sql` change come with the code).

## Android widget (user-requested, 2026-09-30)

Status: **awaiting user device check** (agent work done) · Spec: SCOPE-01, UX-22, NAV-10, DATA-22, ARCH-23, DS-14 · In-session; the T2 spike runs on the user's Zenfone (user decision 2026-09-30), otherwise gate on `npm run check`.

### Tasks

- [x] T1 Specs.
- [x] T2 Spike: `react-native-android-widget` 0.22.1 + plugin config + `index.ts` entry. Zenfone dev build 2026-09-30: the headless task (WorkManager, app process) opened SQLite while the app ran and rendered `v4 · 9 entries`; resize re-rendered. Spike handler in `src/features/widget/widgetTaskHandler.tsx`, replaced in T3.
- [x] T3 View model + task handler + i18n (en, pt-PT) + tests: `caloriesLeftViewModel.ts` (ring labels reused), `readWidgetDay.ts` (Diary `loadDay` + settings), `openWidgetDatabase()` (pragmas only, `null` unless fully migrated), `CaloriesLeftWidget.tsx` (DS-14), global library mock `androidWidgetMock.ts`; tests `caloriesLeftViewModel.test.ts`, `widgetTaskHandler.test.ts`.
- [x] T4 `refreshWidget` + global `MutationCache.onSuccess` + refresh after startup and after the dev seed + tests (`refreshWidget.test.tsx`, `query-client.test.ts`). Widget connection made read-only (ARCH-23). Zenfone 2026-09-30: widget matched the Diary (1,354 kcal left), dropped to 1,254 on a 100 kcal Quick Calories save and returned on delete.
- [x] T5 NAV-10 deep link: `shared/navigation/widgetLink.ts`, `+native-intent.tsx` (cold → `/diary`, warm → keep screen + ask the Diary root), `DiaryScreen` sets today only when focused with no overlay (`shared/components/overlayPresence.ts`, counted by `BottomSheet`/`ConfirmationDialog`, plus the date picker). Tests `widgetLink.test.ts`, `widget-today.nav.test.tsx`. Zenfone 2026-09-30: warm tap at the Diary root Tomorrow → Today; from Profile stays on Profile, Diary keeps Tomorrow. Cold tap in the **dev build** opens the Expo dev launcher (dev-client behavior); cold start in a release build is the user's device check.
- [x] T6 Widget JSX (DS-14, landed in T3) + picker preview `assets/widget-calories-left-preview.png` (Roboto, 1,731 kcal left) + en/pt-PT picker label and description (`plugins/withWidgetStrings.js`; APK resources checked with `aapt2`). Zenfone reinstall: the placed widget kept working (1,354 kcal left).
- [ ] Device check: the user's. Open: cold-start tap in a release build (the dev build opens the Expo dev launcher), the widget after local midnight (≤ 30 min, DATA-22), pt-PT picker text and widget on a pt-PT phone, the picker preview.

## Nutrient details (user-requested, 2026-09-30)

Status: **agent work done; device check and pt-PT review are the user's** · Spec: SCOPE-01/06/10, DATA-20/21 (+ DATA-04/05/06/16/17), PROV-14, UX-02/05/06/08/15/21, DS-08/09, NAV-06 · Same working rules as M9: in-session, no device tests, gate on `npm run check`.

### Tasks

- [x] T1 Specs (this commit).
- [x] T2 Catalog `src/domain/nutrition/nutrientCatalog.ts` + `dashboardNutrients.ts`; migration 4 (`004_nutrient_catalog.ts`: `food_nutrients`, `diary_entry_nutrients`, `dashboard_nutrients`, `dashboard_nutrients_open`) + `schema.sql` v4; `Nutrients.extra` / `NutrientTotals.extra` + `nutrientTotal`; foods (write/replace rows, salt↔sodium), diary (snapshot, edit scale/recompute, SQL per-meal totals, copy, undo), settings (DATA-21 get/set, open state); tests `nutrientCatalog.test.ts`, `repositories/__tests__/nutrients.test.ts`, migrations v1/v2/v3 → v4.
- [x] T3 USDA PROV-14 mapping (`usda/mapper.ts`: numbers → catalog units, IU vitamin D ÷ 40, Branded `labelNutrients` fallback, > 100 g bound), `PARSER_VERSION` 2; fixtures `synthetic-detail-catalog.json`, `synthetic-detail-branded-label.json`; captured-fixture expectations now include fibre. PROV-09 gap fixed: `refreshSavedFood` refreshes USDA as well as OFF, from Saved and Recent. Capture script keeps the PROV-14 numbers; the captured fixtures were not re-recorded (needs a USDA key).
- [x] T4 OFF PROV-14 mapping (`open-food-facts/mapper.ts`: `nutriments` keys in g → catalog units, `*_serving` fallback, > 100 g bound, `vitamin-b9` → `folates`, alcohol ignored), `PARSER_VERSION` 2; fixture `synthetic-product-catalog.json`; OFF refresh test in `food-search.queries.test.ts`.
- [x] T5 Food Detail / Edit entry Nutrition facts (UX-05/06): `components/NutritionFacts.tsx` (grouped, catalog order, scaled live, `<0.1` for tiny known amounts, spoken units), `formatNutrientAmount`; entry path scales the snapshot with `scaleNutrients`; `nutrients.*` strings en + pt-PT (28 names, 4 groups; pt-PT wording not yet reviewed by the user); tests in `FoodDetailScreen.test.tsx`, `format.test.ts`.
- [x] T6 Dashboard Nutrients (UX-21, UX-15, NAV-06): `DashboardNutrientsScreen.tsx` (`Shown` reorderable, hidden by group), route `/profile/dashboard-nutrients` + `routes.dashboardNutrients()`, Profile row `<n> shown` / `None`; shared `ReorderableSwitchRow` extracted from `SearchResultsGroup`; hooks `useDashboardNutrients` / `useSetDashboardNutrients` (+ open state for T7); tests `dashboard-nutrients.nav.test.tsx`, `ProfileScreen.test.tsx`.
- [x] T7 Diary chevron + nutrient panel (UX-02, DS-08): `components/NutrientPanel.tsx` (DATA-21 order, `nutrientTotal`, partial note in the a11y label, fade unless reduced motion), chevron in `DiaryDay` `Overview` (hidden with no visible nutrients; open state saved via `useSetDashboardNutrientsOpen`, optimistic); `PressableIcon` `expanded` state; tests in `DiaryScreen.test.tsx`.
- [x] T8 Custom food More nutrients (UX-08): collapsed disclosure in `CreateCustomFoodScreen.tsx`, grouped optional fields for 27 catalog nutrients (sodium derived from salt), per the entered serving, each bounded 0–1,000 g in its own unit (`customFoodNutrientMax`); `customFood.ts` form values `extra` + mapping; tests `customFood.test.ts`, `CreateCustomFoodScreen.test.tsx`.
- [ ] Device check: the user's (Diary chevron/panel, Dashboard nutrients drag, Food Detail list, custom food More nutrients, migration 4 on the existing phone DB).
- [ ] The user reviews the new pt-PT strings (`nutrients.*`, `dashboardNutrients.*`, `diaryNutrients.*`, `customFood.moreNutrients*`).

## Barcode scanning (user-requested, 2026-09-30)

Status: **in progress** · Spec: SCOPE-01/10, NAV-02/03/04, DATA-17/24, PROV-15, UX-04/08/09/24, DS-09/10, ARCH-24 · Same working rules as M9: in-session, no device tests, gate on `npm run check`.

### Tasks

- [x] T1 Specs (this commit). User decisions: entry from Food Search + the `+` sheet; a custom food created from a scan keeps its barcode; lookup checks OFF and USDA, never a hidden or unavailable provider.
- [x] T2 `src/domain/food/barcode.ts` (check digit, UPC-E expansion, GTIN-14, display/USDA forms); migration 6 `006_food_barcode.ts` (column + index + OFF backfill) + `schema.sql` v6; `foodsRepository` `barcode` on read/create/upsert + `findByBarcode`; OFF/USDA mappers write `barcode` (USDA `gtinUpc`, `PARSER_VERSION` 3; captured Branded fixture gained its live `gtinUpc`). Tests `barcode.test.ts`, `migrations.test.ts`, `foods-diary.test.ts`, mapper tests.
- [x] T3 PROV-15 lookup `src/features/food-search/barcodeLookup.ts` (saved → visible + available remote providers in DATA-19 order; hidden, keyless or offline providers get no request; failures continue to the next provider); `UsdaClient.findBarcode` + `mapUsdaBarcodeSearch` (Branded search by UPC-A/GTIN-13, `gtinUpc` must match); `saveExternalCandidate` shared with Food Detail. Fixtures `captured/search-barcode-031200037206.json` (trimmed from the 2026-09-30 live check), `synthetic-search-barcode-mismatch.json`; tests `usda/__tests__/barcode.test.ts`, `barcodeLookup.test.ts`.
- [ ] T4 `expo-camera` + config plugin + iOS pt-PT permission text; Barcode Scanner screen + route (UX-24); Food Search scan icon; `+` sheet row; Create Custom Food `barcode` param.
- [ ] Device check: the user's (native rebuild needed; camera permission, scanning on both OSes, USDA 13/14-digit `gtinUpc` with a real key).

## M9 Hardening

Status: **awaiting user acceptance** (agent work done; T5 phone smoke test and the pt-PT review are the user's) · Start commit: `7a84bb7` · User instructions 2026-09-28: work in-session, no subagents, no Maestro or other device tests (gate on `npm run check`).

### Tasks

- [x] T1 Food Search section order + visibility, data and search (DATA-19, UX-18, UX-04): migration 2 `food_search_sections` + `schema.sql` v2, `src/domain/food/searchSections.ts` (Zod, default fallback, move/visibility helpers), `settingsRepository.get/setFoodSearchSections`, `useFoodSearchSections`/`useSetFoodSearchSections`; Food Search renders visible sections in the saved order, hidden remote sections send no requests, Saved dedupe only while Saved is visible, offline row above the first visible remote section; tests `searchSections.test.ts`, `migrations.test.ts`, `settings-goals.test.ts`, `seed.test.ts`, `FoodSearchScreen.test.tsx` (M9 extra).
- [x] T2 Food Databases `Search results` group (UX-18): `src/features/profile/components/SearchResultsGroup.tsx` on `FoodDatabasesScreen` — per-section switch + drag handle (UX-17 helpers) + a11y Move up/down, saves on each change, last visible switch disabled with helper; en + pt-PT; tests in `FoodDatabasesScreen.test.tsx`; test QueryClient now uses mutation `gcTime: 0` (`src/shared/testing/services.tsx`).
- [x] T3 pt-PT complete (315 keys, nothing untranslated) + user review sheet `docs/qa/M9/pt-PT-copy-review.md`; DS-11 code-level pass, no defects (contrast, scaling, labels, gesture alternatives); DS-13 device check deferred by the user. Evidence: `docs/qa/M9/a11y-and-ds13-2026-09-28.md`.
- [x] T4 ARCH-19 performance checks, code-level (no device profiling, per the user): indexes, SQL totals, debounce/cancel, paging, virtualized lists, worklet ruler, no sync SQLite all hold; 2 minor gaps logged. Evidence: `docs/qa/M9/performance-2026-09-28.md`.
- [ ] T5 Release-config builds + ROAD-04 smoke test on the user's phone: **handed to the user** (commands in the acceptance report below).
- [ ] T6 Maestro E2E suite: deferred by the user (includes the untested `7a84bb7` flow fixes).

### ROAD-02 checklist

- [x] Main specs implemented at code level: UX-18 `Search results` + DATA-19 (T1/T2), DS-11 (T3), ARCH-19 (T4); DS-13 and ARCH-18 device parts deferred by the user; ROAD-04 smoke test is the user's (T5)
- [x] `npm run check` green at the milestone boundary (80 suites / 538 tests, `9161e63`; later M9 commits are docs only)
- [x] M9 extra: hidden remote sections send no requests; sections render in the saved order (T1)
- [ ] The user reviews the pt-PT copy (sheet ready: `docs/qa/M9/pt-PT-copy-review.md`)
- [x] ARCH-19 performance checks run (code-level, T4)
- [ ] Release-config build passes the ROAD-04 smoke test
- [ ] Every ARCH-18 E2E flow green on both platforms (deferred by the user)

### Changelog (M9 finish checklist step 2)

- MVP feature-complete: Diary with a scrollable date strip and overview day chevrons, swipe-delete entries, dashboard item/meal copy, Quick Calories, custom foods + ruler, Food Search (My foods, Saved, Open Food Facts, USDA; 10 per page; section order and visibility set on Food Databases), USDA key flow, Profile (goals, meals, units, weight goal, weight history), en + pt-PT.

### Acceptance report (ROAD-03)

Built this milestone: Food Search section order + visibility (DATA-19 migration 2, UX-18 `Search results`, UX-04 wiring; hidden remote sections send no requests), pt-PT completeness + review sheet, DS-11 and ARCH-19 code-level passes. Per the user: no subagents, no device tests, no independent review round.

Left for the user:
1. Review the pt-PT copy: `docs/qa/M9/pt-PT-copy-review.md`.
2. Release-config smoke test on a phone (ROAD-04): `npx expo run:ios --configuration Release --device` or `npx expo run:android --variant release` with the phone connected. Then first launch → add Quick Calories → log an Open Food Facts food → go offline and log a saved food → relaunch and check the data persisted.
3. Maestro suite on both platforms (T6), including the untested `7a84bb7` flow fixes: deferred until the user wants it.

### Known gaps

- `m8-weight` native SIGSEGV on Android launch seen once, not reproduced.
- ARCH-19 (minor): `weight.history()` unbounded; Food Search sections in a `ScrollView` (bounded by paging). See `docs/qa/M9/performance-2026-09-28.md`.

### Open questions

- None.
