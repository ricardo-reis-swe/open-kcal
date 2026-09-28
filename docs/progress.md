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
| M7 Meal Detail + copy | in progress |
| M8 Profile | not started |
| M9 Hardening | not started |

Spec changes: 2026-09-28 DS-13 reduced to light theme · iOS + Android · one phone size · default text; the matrix moved to POST-13. ROAD-03: one-line task entries, accepted milestones archived.

## M7 Meal Detail + copy

Status: **in progress** · Start commit: `6c78c1a` (review range `6c78c1a..HEAD`)

### Tasks

- [x] T1 Copy meal transaction + Meal Detail model: `diaryRepository.copyMeal` (DATA-16), `useDiaryMeal` + `useDiaryWrites().copyMeal` in `src/features/diary/diary.queries.ts`; tests `src/data/db/repositories/__tests__/copy-meal.test.ts` (exact snapshots, order, append, same-date duplicates, independence, rollback).
- [x] T2 Meal Detail screen (UX-03, NAV-04): `src/features/diary/screens/MealDetailScreen.tsx` at `/diary/meal/[mealId]` (`routes.mealDetail`), Diary header tap → Meal Detail and header `+` → Food Search; entries return with `origin: mealDetail`; `Copy meal` opens sheet state for T3 (no sheet yet); tests `src/features/diary/__tests__/meal-detail.nav.test.tsx`.
- [x] T3 Copy Meal Sheet + copy flow (UX-12, UX-13, NAV-07): `src/features/diary/components/CopyMealFlow.tsx` (absolute Today/Tomorrow, `Choose date…` → Date Picker `Copy to date`), rendered by `MealDetailScreen.tsx`, which stays on the source and shows an `InlineStatus` toast (success/error, 4 s); en + pt-PT `copyMeal.*`; Android checked by hand (tomorrow + picked date → `Copied 1 item to Breakfast, …`).
- [x] T4 Focused tests (navigation + return rules): `src/features/diary/__tests__/meal-detail.nav.test.tsx` (sheet close, tomorrow, absolute shortcuts from tomorrow + same-date duplicates, picked date, picker cancel) and `CopyMealFlow.test.tsx` (labels, pt-PT smoke, failed copy → error); no Maestro flow (ARCH-18 table).

### ROAD-02 checklist

- [x] Main specs implemented (UX-03/12, NAV-07, DATA-16)
- [x] `npm run check` green at the milestone boundary
- [x] Focused tests for changed data/navigation logic
- [x] Android Maestro flow: n/a (M7 adds none, ARCH-18 table)
- [x] Every string in `en` + `pt-PT`
- [x] No placeholder UI for in-scope behavior
- [x] Known gaps listed
- [x] Nothing sensitive in logs

Exit demo: copy a meal to tomorrow and to a picked date; return rules hold.

### Known gaps

- PROV-12 dev-build diagnostic logging in the USDA/OFF adapters (carried from M6).
- Short dates in `en` follow the device `Intl` format (`Fri, Sep 25`), not the UX-12 example `Fri 25 Sep`; same formatter as the Diary (UX-02).
- The Date Picker `Today` a11y hint still says `Shows today's diary` in Copy destination mode (UX-13 only changes the title).

### Open questions

- None.
