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
| M7 Meal Detail + copy | done |
| M8 Profile | done |
| M9 Hardening | not started |

Spec changes: 2026-09-28 DS-13 reduced to light theme · iOS + Android · one phone size · default text; the matrix moved to POST-13. ROAD-03: one-line task entries, accepted milestones archived. 2026-09-28 (user-requested, commit below "feat(diary): scrollable date strip") UX-02 date strip is a windowed horizontal scroll of day buttons that re-centers on every selection change; scrolling it never changes the day (`DiaryDateStrip.tsx`, `dateStripWindow.ts`, tests `DiaryDateStrip.test.tsx`/`dateStripWindow.test.ts`; `m2-swipe-date` PASS Android + iOS, `m2-launch-today` PASS iOS, Android fails only at `Lunch, .*` because the emulator's Lunch meal was deleted in the M8 by-hand review; strip scroll then page swipe re-centered checked by hand on Android).

2026-09-28 (user-approved, commit "feat(food-search): separate provider sections, 10 per page") UX-04/PROV-08: reverted the merged `Online` list (4a3df52) to separate `Open Food Facts` and `USDA` sections, each with its own `Show more` and inline status (OFF now also shows its busy state); remote page size 10 (cap 5 pages = 50 per section); kept `keyboardShouldPersistTaps`, the `food-search-create-custom` testID and the m4 top-action tap (`FoodSearchScreen.tsx`, `usda/client.ts`, `open-food-facts/client.ts`; tests `FoodSearchScreen.test.tsx`, client tests); live Android `egg` checked.

2026-09-28 (user-approved, commit "docs(spec): Food Search section order and visibility") SCOPE-01/UX-18/UX-04/DATA-19/ROAD-01/ROAD-02: new MVP feature for M9, reorder and show/hide the 4 Food Search sections on Food Databases (spec only; migration 2 + `schema.sql` change come with the code).

## M9 Hardening

Status: planned. Scope also includes Food Search section order + visibility (UX-18 `Search results`, DATA-19). Task list is created at M9 start.

## M8 Profile

Status: **done** (accepted by the user 2026-09-28) · Start commit: `58b4d18`

### Tasks

- [x] T1 Data/services: repositories existed from M1; added `weight.history()`, UX-00 ranges in repos (meal name ≤40, weight/goal weight 20–500 kg, goals 500–10,000 kcal / 0–1,000 g), domain helpers (`macroEnergyShare`, `invalidGoalFields` in `src/domain/nutrition/goals.ts`; `weightHistoryRows`, `isValidWeightKg` in `src/domain/weight/weight.ts`; `src/domain/meals/meals.ts` duplicate-name/move), hooks `src/features/profile/profile.queries.ts`; tests `src/features/profile/__tests__/profile.queries.test.tsx`, `src/domain/meals/__tests__/meals.test.ts`, rollback incl. recents in `src/data/db/repositories/__tests__/meals.test.ts`. iOS dev build rebuilt (netinfo crash fixed).
- [x] T2 Profile hub `src/features/profile/screens/ProfileScreen.tsx`: weight summary, rows with values (goal kcal/kJ, goal weight, meal count, units, USDA on/off); rows navigate only once wired (T3–T6 wire theirs; Food databases wired); `formatWeight` 1 decimal; tests `ProfileScreen.test.tsx`, `format.test.ts`; Android hand check (values + Food databases row).
- [x] T3 Calories & Macros `src/features/profile/screens/CaloriesMacrosScreen.tsx` + route `profile/calories-macros` (Profile row + Diary `Set goals` pushed `withAnchor`; Save → Profile; dirty back/system back → Discard; provisional save allowed unchanged, confirms in place); parsers in `goals.ts`; tests `CaloriesMacrosScreen.test.tsx`, `calories-macros.nav.test.tsx`, `goals.test.ts`; Android hand check (helpers, Discard, save → Profile, Diary row gone).
- [x] T4 Meals + Add/Edit Meal: `MealsScreen.tsx` (handle drag + long-press drag commit on drop, a11y Move up/down; testIDs `meals-row-<i>`, `meals-handle-<i>`, `meals-add`), `MealEditScreen.tsx` (name ≤40, duplicate warning, delete dialog / move-entries sheet, last-meal disabled), routes `profile/meals`, `meals/new`, `meals/[mealId]`, Profile row wired; tests `MealsScreen.test.tsx`, `MealEditScreen.test.tsx`, `meals.nav.test.tsx`, `meals.test.ts` (`dropIndex`, `moveMealToIndex`).
- [x] T5 Units + Weight Goal: `UnitsScreen.tsx` (4 segmented `TextAction` groups, save on tap), `WeightGoalScreen.tsx` (display-unit field, UX-00 20–500 kg range via `weightInputRange`/`parseWeightInput`/`weightInputText` in `weight.ts`, `Clear goal`, Save → Profile), routes `profile/units`, `profile/weight-goal`, Profile rows wired; every unit consumer (Diary day, Meal Detail, Quick Calories, Food Search/Detail/entry edit, Create Custom Food, Calories & Macros, Profile) reads `useAppSettings`; tests `units-weight-goal.nav.test.tsx` (kJ change → Profile + Diary ring), `UnitsScreen.test.tsx`, `WeightGoalScreen.test.tsx`, `weight.test.ts`.
- [x] T6 Weight Entry Sheet + Weight History: app-level `WeightEntrySheet.tsx` via `WeightEntryProvider` (tabs layout; opened from `+` Update weight, Profile, Weight History), date ≤ today (`DatePicker` `maximumDate`), display-unit input, Save disabled until valid/changed, confirmed delete; `BottomSheet` `avoidKeyboard`; `WeightHistoryScreen.tsx` + route `profile/weight-history` (newest first, time when same day, `−0.4 kg` change, `+`, empty state); testIDs `profile-update-weight`, `profile-weight-history`, `add-action-update-weight`, `weight-entry-{sheet,date,input,save,delete}`, `weight-entry-delete-dialog-confirm`, `weight-history-{add,empty-add,row-<i>}`; tests `weight.nav.test.tsx`.
- [x] T7 Maestro flows `.maestro/m8-reorder-meals.yaml` (handle drag first→last, persists after reopening, drag back) and `.maestro/m8-weight.yaml` (add from Profile → summary, edit from Weight History row, confirmed delete; whole-number input so any locale decimal works) pass on Android + iOS (`scripts/e2e.sh android|ios <flow>`); fixed iOS Hermes crash opening the weight sheet (`Intl.NumberFormat#formatToParts` missing) in `src/domain/food/customFood.ts` + test in `customFood.test.ts`; `avoidKeyboard` keeps Save above the keypad on iOS.
- [x] T8 Review fix (ARCH-22): one pt-PT smoke render per M8 screen in `src/features/profile/screens/__tests__/*.test.tsx`, new `WeightHistoryScreen.test.tsx`; review `docs/qa/M8/review.md` (pass).
- [x] Post-review gap fixes (carried M6/M7 gaps): PROV-12 dev diagnostics (provider, endpoint, status, Zod issue path as a `debug` record; release keeps error type + provider) in `src/data/api/diagnostics.ts` + USDA/OFF clients/mappers, key/terms/URL-free asserted in `usda/__tests__/client.test.ts`, `open-food-facts/__tests__/client.test.ts`; `en` short dates `Fri 25 Sep` composed from separate `Intl` formats (no `formatToParts`) in `src/shared/i18n/format.ts`, pt-PT unchanged, `format.test.ts`; Android hardware back after a `ConfirmationDialog`: not reproducible on the current build (emulator-5554, Calories & Macros Discard → Keep editing / backdrop / back-close → back re-asks, Discard leaves; Edit Quick Calories delete → Cancel → back leaves; likely the refocused field's keyboard eating the first back), no code change, regression test `calories-macros.nav.test.tsx` (hardware back via BackHandler twice after the dialog closes). Commits: `ce3d13d` (PROV-12 + dates), `183ad19` (back); Meals drag live shift (UX-17): other rows animate aside to open the drop slot from shared active/hover indexes via `dragShift` in `src/domain/meals/meals.ts` (test in `meals.test.ts`), commit still on drop (DATA-10), in `MealsScreen.tsx`; `m8-reorder-meals.yaml` now swaps rows 0/1 by name (any meal count ≥ 2); `scripts/e2e.sh` PASS `m8-reorder-meals` Android + iOS, `m8-weight` Android.

Food Databases (UX-18) already exists from M6.

### Acceptance report (ROAD-03)

Built: Profile hub (UX-15), Calories & Macros with the UX-01 first save (UX-16, DATA-09), Meals reorder + Add/Edit Meal with delete + reassign (UX-17, DATA-10), Units, Weight Goal, Weight Entry Sheet, Weight History (UX-18, DATA-13); units apply everywhere.

ROAD-02 checklist:
- [x] Main specs implemented (UX-14–18, NAV-06, DATA-09/10/13).
- [x] `npm run check` green at the milestone boundary (T8 commit, exit 0).
- [x] Focused tests for changed data/domain/navigation logic (T1–T6), pt-PT smoke render per screen (ARCH-22, T8).
- [x] M8 extra: meal delete + reassign rolls back fully on failure (`meals.test.ts` `ROAD-02 M8` case: meals, entries and recents unchanged).
- [x] Maestro flows: reorder meals · add and edit weight (ARCH-18): `m8-reorder-meals.yaml`, `m8-weight.yaml`, both platforms (T7).
- [x] Every string in `en` + `pt-PT` (`locales.test.ts` parity).
- [x] No placeholder UI for in-scope behavior (every Profile row wired).
- [x] Known gaps listed below.
- [x] Nothing sensitive in logs (ARCH-15: no weights; no logging in profile/weight code).

Exit demo: `scripts/e2e.sh` PASS for `m8-reorder-meals` and `m8-weight` on Android (`emulator-5554`) and iOS (`iPhone 17e`), 4 runs; reviewer drove meal delete + reassign by hand on Android (Lunch's 3 entries moved to Dinner, order compacted). Review: `docs/qa/M8/review.md` (pass, no blockers or majors).

### Known gaps

- None.

### Open questions

- None.
