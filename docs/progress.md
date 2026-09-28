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
- [ ] T2 Meal Detail screen (UX-03, NAV-07): header, date, total, entry rows, `+ Add food`, empty state, `Copy meal` disabled when empty, Not found when the meal is gone.
- [ ] T3 Copy Meal Sheet + copy flow (UX-12, UX-13 destination mode, NAV-07): Today/Tomorrow absolute shortcuts, `Choose date…`, back to source Meal Detail + success toast.
- [ ] T4 Focused tests / QA wrap-up (navigation + return rules); no Maestro flow for M7 (ARCH-18 table).

### ROAD-02 checklist

- [ ] Main specs implemented (UX-03/12, NAV-07, DATA-16)
- [ ] `npm run check` green at the milestone boundary
- [ ] Focused tests for changed data/navigation logic
- [x] Android Maestro flow: n/a (M7 adds none, ARCH-18 table)
- [ ] Every string in `en` + `pt-PT`
- [ ] No placeholder UI for in-scope behavior
- [ ] Known gaps listed
- [ ] Nothing sensitive in logs

Exit demo: copy a meal to tomorrow and to a picked date; return rules hold.

### Known gaps

- PROV-12 dev-build diagnostic logging in the USDA/OFF adapters (carried from M6).

### Open questions

- None.
