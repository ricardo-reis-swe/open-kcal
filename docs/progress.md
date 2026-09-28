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
| M9 Hardening | in progress |

Spec changes: 2026-09-28 DS-13 reduced to light theme · iOS + Android · one phone size · default text; the matrix moved to POST-13. ROAD-03: one-line task entries, accepted milestones archived. 2026-09-28 (user-requested, commit below "feat(diary): scrollable date strip") UX-02 date strip is a windowed horizontal scroll of day buttons that re-centers on every selection change; scrolling it never changes the day (`DiaryDateStrip.tsx`, `dateStripWindow.ts`, tests `DiaryDateStrip.test.tsx`/`dateStripWindow.test.ts`; `m2-swipe-date` PASS Android + iOS, `m2-launch-today` PASS iOS, Android fails only at `Lunch, .*` because the emulator's Lunch meal was deleted in the M8 by-hand review; strip scroll then page swipe re-centered checked by hand on Android).

2026-09-28 E2E flow fixes (ARCH-18): `m2-launch-today` independent of meal state; `m4-custom-food` no `hideKeyboard` (Serving sheet `avoidKeyboard` keeps Done above the iOS decimal pad); `m5-offline-foods` seeds its own data; `m5-offline-local-foods` uses a dev-only seed deep link (`devSeedLink.ts`, `+native-intent.tsx`) with the normal Metro, replacing `scripts/e2e-m5-offline-android.sh`; USDA key-missing no longer logged as a provider failure (PROV-12); Meals drop index clamped to the list when a drag ends over the app bar (UX-17). `npm run check` green (79 suites / 515 tests). **Not yet run on devices**: those 4 flows (Android) + `m4-custom-food` (iOS); verify in M9. Known gap: `m8-weight` native SIGSEGV on Android launch seen once, not reproduced.

2026-09-28 (user-approved, commit "feat(food-search): separate provider sections, 10 per page") UX-04/PROV-08: reverted the merged `Online` list (4a3df52) to separate `Open Food Facts` and `USDA` sections, each with its own `Show more` and inline status (OFF now also shows its busy state); remote page size 10 (cap 5 pages = 50 per section); kept `keyboardShouldPersistTaps`, the `food-search-create-custom` testID and the m4 top-action tap (`FoodSearchScreen.tsx`, `usda/client.ts`, `open-food-facts/client.ts`; tests `FoodSearchScreen.test.tsx`, client tests); live Android `egg` checked.

2026-09-28 (user-approved, commit "docs(spec): Food Search section order and visibility") SCOPE-01/UX-18/UX-04/DATA-19/ROAD-01/ROAD-02: new MVP feature for M9, reorder and show/hide the 4 Food Search sections on Food Databases (spec only; migration 2 + `schema.sql` change come with the code).

## M9 Hardening

Status: **in progress** · Start commit: `7a84bb7` · User instructions 2026-09-28: work in-session, no subagents, no Maestro or other device tests (gate on `npm run check`).

### Tasks

- [x] T1 Food Search section order + visibility, data and search (DATA-19, UX-18, UX-04): migration 2 `food_search_sections` + `schema.sql` v2, `src/domain/food/searchSections.ts` (Zod, default fallback, move/visibility helpers), `settingsRepository.get/setFoodSearchSections`, `useFoodSearchSections`/`useSetFoodSearchSections`; Food Search renders visible sections in the saved order, hidden remote sections send no requests, Saved dedupe only while Saved is visible, offline row above the first visible remote section; tests `searchSections.test.ts`, `migrations.test.ts`, `settings-goals.test.ts`, `seed.test.ts`, `FoodSearchScreen.test.tsx` (M9 extra).
- [ ] T2 Food Databases `Search results` group (UX-18): switches + reorder, save on change, last-visible switch disabled.
- [ ] T3 pt-PT completeness + copy review sheet for the user; accessibility pass (DS-11); DS-13 MVP check (code-level).
- [ ] T4 ARCH-19 performance checks (code-level).
- [ ] T5 Release-config builds + ROAD-04 smoke test on the user's phone (user runs it; no device tests by the agent).
- [ ] T6 Maestro E2E suite: deferred by the user (includes the untested `7a84bb7` flow fixes).

### ROAD-02 checklist

- [ ] Main specs implemented (DS-11/13, ARCH-18/19, ROAD-04, UX-18 `Search results`, DATA-19)
- [ ] `npm run check` green at the milestone boundary
- [x] M9 extra: hidden remote sections send no requests; sections render in the saved order (T1)
- [ ] The user reviews the pt-PT copy
- [ ] ARCH-19 performance checks run
- [ ] Release-config build passes the ROAD-04 smoke test
- [ ] Every ARCH-18 E2E flow green on both platforms (deferred by the user)

### Known gaps

- `m8-weight` native SIGSEGV on Android launch seen once, not reproduced.

### Open questions

- None.

