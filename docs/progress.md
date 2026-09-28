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
| M8 Profile | in progress |
| M9 Hardening | not started |

Spec changes: 2026-09-28 DS-13 reduced to light theme · iOS + Android · one phone size · default text; the matrix moved to POST-13. ROAD-03: one-line task entries, accepted milestones archived.

## M8 Profile

Status: **in progress** · Start commit: `58b4d18`

### Tasks

- [x] T1 Data/services: repositories existed from M1; added `weight.history()`, UX-00 ranges in repos (meal name ≤40, weight/goal weight 20–500 kg, goals 500–10,000 kcal / 0–1,000 g), domain helpers (`macroEnergyShare`, `invalidGoalFields` in `src/domain/nutrition/goals.ts`; `weightHistoryRows`, `isValidWeightKg` in `src/domain/weight/weight.ts`; `src/domain/meals/meals.ts` duplicate-name/move), hooks `src/features/profile/profile.queries.ts`; tests `src/features/profile/__tests__/profile.queries.test.tsx`, `src/domain/meals/__tests__/meals.test.ts`, rollback incl. recents in `src/data/db/repositories/__tests__/meals.test.ts`. iOS dev build rebuilt (netinfo crash fixed).
- [x] T2 Profile hub `src/features/profile/screens/ProfileScreen.tsx`: weight summary, rows with values (goal kcal/kJ, goal weight, meal count, units, USDA on/off); rows navigate only once wired (T3–T6 wire theirs; Food databases wired); `formatWeight` 1 decimal; tests `ProfileScreen.test.tsx`, `format.test.ts`; Android hand check (values + Food databases row).
- [x] T3 Calories & Macros `src/features/profile/screens/CaloriesMacrosScreen.tsx` + route `profile/calories-macros` (Profile row + Diary `Set goals` pushed `withAnchor`; Save → Profile; dirty back/system back → Discard; provisional save allowed unchanged, confirms in place); parsers in `goals.ts`; tests `CaloriesMacrosScreen.test.tsx`, `calories-macros.nav.test.tsx`, `goals.test.ts`; Android hand check (helpers, Discard, save → Profile, Diary row gone).
- [x] T4 Meals + Add/Edit Meal: `MealsScreen.tsx` (handle drag + long-press drag commit on drop, a11y Move up/down; testIDs `meals-row-<i>`, `meals-handle-<i>`, `meals-add`), `MealEditScreen.tsx` (name ≤40, duplicate warning, delete dialog / move-entries sheet, last-meal disabled), routes `profile/meals`, `meals/new`, `meals/[mealId]`, Profile row wired; tests `MealsScreen.test.tsx`, `MealEditScreen.test.tsx`, `meals.nav.test.tsx`, `meals.test.ts` (`dropIndex`, `moveMealToIndex`).
- [x] T5 Units + Weight Goal: `UnitsScreen.tsx` (4 segmented `TextAction` groups, save on tap), `WeightGoalScreen.tsx` (display-unit field, UX-00 20–500 kg range via `weightInputRange`/`parseWeightInput`/`weightInputText` in `weight.ts`, `Clear goal`, Save → Profile), routes `profile/units`, `profile/weight-goal`, Profile rows wired; every unit consumer (Diary day, Meal Detail, Quick Calories, Food Search/Detail/entry edit, Create Custom Food, Calories & Macros, Profile) reads `useAppSettings`; tests `units-weight-goal.nav.test.tsx` (kJ change → Profile + Diary ring), `UnitsScreen.test.tsx`, `WeightGoalScreen.test.tsx`, `weight.test.ts`.
- [x] T6 Weight Entry Sheet + Weight History: app-level `WeightEntrySheet.tsx` via `WeightEntryProvider` (tabs layout; opened from `+` Update weight, Profile, Weight History), date ≤ today (`DatePicker` `maximumDate`), display-unit input, Save disabled until valid/changed, confirmed delete; `BottomSheet` `avoidKeyboard`; `WeightHistoryScreen.tsx` + route `profile/weight-history` (newest first, time when same day, `−0.4 kg` change, `+`, empty state); testIDs `profile-update-weight`, `profile-weight-history`, `add-action-update-weight`, `weight-entry-{sheet,date,input,save,delete}`, `weight-entry-delete-dialog-confirm`, `weight-history-{add,empty-add,row-<i>}`; tests `weight.nav.test.tsx`.
- [ ] T7 Maestro flows `m8-reorder-meals` and `m8-weight` on both platforms

Food Databases (UX-18) already exists from M6.

### ROAD-02 checklist

- [ ] Main specs implemented (UX-14–18, NAV-06, DATA-09/10/13).
- [ ] `npm run check` green at the milestone boundary.
- [x] Focused tests for changed data/domain logic (T1).
- [x] M8 extra: meal delete + reassign rolls back fully on failure (`meals.test.ts` `ROAD-02 M8` case: meals, entries and recents unchanged).
- [ ] Maestro flows: reorder meals · add and edit weight (ARCH-18).
- [ ] Every string in `en` + `pt-PT`.
- [ ] No placeholder UI for in-scope behavior.
- [ ] Known gaps listed below.
- [ ] Nothing sensitive in logs (ARCH-15: no weights).

### Known gaps

- Android: after any `ConfirmationDialog` closes, hardware back stops working on that screen (pre-existing, also Edit Quick Calories); app bar Back works. Spun off as a separate task.
- Meals drag: only the dragged row moves while dragging (others don't shift live); the order commits on drop.

### Open questions

- None.
