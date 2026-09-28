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
| M7 Meal Detail + copy | awaiting user acceptance |
| M8 Profile | in progress |
| M9 Hardening | not started |

Spec changes: 2026-09-28 DS-13 reduced to light theme · iOS + Android · one phone size · default text; the matrix moved to POST-13. ROAD-03: one-line task entries, accepted milestones archived.

## M7 Meal Detail + copy

Status: **awaiting user acceptance** · Start commit: `6c78c1a` · independent review passed (`docs/qa/M7/review.md`, reviewed HEAD `9060795`)

### Tasks

- [x] T1 Copy meal transaction + Meal Detail model: `diaryRepository.copyMeal` (DATA-16), `useDiaryMeal` + `useDiaryWrites().copyMeal` in `src/features/diary/diary.queries.ts`; tests `src/data/db/repositories/__tests__/copy-meal.test.ts` (exact snapshots, order, append, same-date duplicates, independence, rollback).
- [x] T2 Meal Detail screen (UX-03, NAV-04): `src/features/diary/screens/MealDetailScreen.tsx` at `/diary/meal/[mealId]` (`routes.mealDetail`), Diary header tap → Meal Detail and header `+` → Food Search; entries return with `origin: mealDetail`; `Copy meal` opens sheet state for T3 (no sheet yet); tests `src/features/diary/__tests__/meal-detail.nav.test.tsx`.
- [x] T3 Copy Meal Sheet + copy flow (UX-12, UX-13, NAV-07): `src/features/diary/components/CopyMealFlow.tsx` (absolute Today/Tomorrow, `Choose date…` → Date Picker `Copy to date`), rendered by `MealDetailScreen.tsx`, which stays on the source and shows an `InlineStatus` toast (success/error, 4 s); en + pt-PT `copyMeal.*`; Android checked by hand (tomorrow + picked date → `Copied 1 item to Breakfast, …`).
- [x] T4 Focused tests (navigation + return rules): `src/features/diary/__tests__/meal-detail.nav.test.tsx` (sheet close, tomorrow, absolute shortcuts from tomorrow + same-date duplicates, picked date, picker cancel) and `CopyMealFlow.test.tsx` (labels, pt-PT smoke, failed copy → error); no Maestro flow (ARCH-18 table).

### Acceptance report (ROAD-03)

Built: Meal Detail (UX-03) from the Diary meal header, Copy Meal Sheet with Today/Tomorrow/`Choose date…` (UX-12), Date Picker in `Copy to date` mode (UX-13), transactional `copyMeal` snapshot copy (DATA-16), stay-on-source + toast return rule (NAV-07).

ROAD-02 checklist:
- [x] Main specs implemented (UX-03/12/13, NAV-04/07, DATA-16).
- [x] `npm run check` green at the milestone boundary (exit 0; 63 suites / 429 tests).
- [x] Focused tests for changed data/navigation logic (`copy-meal.test.ts`, `meal-detail.nav.test.tsx`, `CopyMealFlow.test.tsx`, `food-routes.test.ts`).
- [x] Android Maestro flow: n/a (M7 adds none, ARCH-18 table).
- [x] Every string in `en` + `pt-PT` (`mealDetail.*`, `copyMeal.*`; locale parity test).
- [x] No placeholder UI for in-scope behavior.
- [x] Known gaps listed below.
- [x] Nothing sensitive in logs (ARCH-15; no new logging).

Exit demo (Android emulator, review §Manual exit demo in `docs/qa/M7/review.md`): Diary → Breakfast header → Meal Detail → `Copy meal` → Tomorrow → toast, source unchanged, copy on tomorrow; `Copy meal` → `Choose date…` → pick Sep 5 → Done → toast, copy on Sep 5; Back → Diary on the source date.

### Known gaps

- PROV-12 dev-build diagnostic logging in the USDA/OFF adapters (carried from M6).
- Short dates in `en` follow the device `Intl` format (`Fri, Sep 25`), not the UX-02/UX-12 example `Fri 25 Sep` (`src/shared/i18n/format.ts` `formatShortDate`, since M2; review finding 1, minor).

### Open questions

- None.

## M8 Profile

Status: **in progress** · Start commit: `58b4d18`

### Tasks

- [x] T1 Data/services: repositories existed from M1; added `weight.history()`, UX-00 ranges in repos (meal name ≤40, weight/goal weight 20–500 kg, goals 500–10,000 kcal / 0–1,000 g), domain helpers (`macroEnergyShare`, `invalidGoalFields` in `src/domain/nutrition/goals.ts`; `weightHistoryRows`, `isValidWeightKg` in `src/domain/weight/weight.ts`; `src/domain/meals/meals.ts` duplicate-name/move), hooks `src/features/profile/profile.queries.ts`; tests `src/features/profile/__tests__/profile.queries.test.tsx`, `src/domain/meals/__tests__/meals.test.ts`, rollback incl. recents in `src/data/db/repositories/__tests__/meals.test.ts`. iOS dev build rebuilt (netinfo crash fixed).
- [ ] T2 Profile screen (UX-15, NAV-06)
- [ ] T3 Calories & Macros with the UX-01 first save (UX-16)
- [ ] T4 Meals + Add/Edit Meal: reorder, add, edit, delete + reassign (UX-17, UX-19)
- [ ] T5 Units + Weight Goal (UX-18), unit changes showing everywhere
- [ ] T6 Weight Entry Sheet + Weight History (UX-14, UX-18)
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

- None yet.

### Open questions

- None.
