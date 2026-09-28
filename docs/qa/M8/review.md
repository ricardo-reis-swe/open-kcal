# M8 Profile — QA review

Reviewed HEAD: `2dbdd10` (`58b4d18..HEAD`)
Verdict: **pass** (one minor gap noted below; no blockers or majors)

## ROAD-02 checklist

- [x] Main specs implemented (UX-14–18, NAV-06, DATA-09/10/13, UX-00/01/19 rules, NAV-03/04/07 touch-points, ARCH-22 copy). Traced each screen to its spec section; domain helpers (`meals.ts`, `weight.ts`, `goals.ts`) match the wireframes and rules exactly, incl. UX-01 provisional-save-in-place, DATA-09 upsert-effective-today, DATA-13 `measured_at`/`local_date` agreement, DATA-10 two-phase reorder and delete+reassign+compact.
- [x] `npm run check` green — lint, `tsc`, and Jest all pass: 75 suites / 487 tests, exit 0.
- [x] Focused tests for changed domain/data/navigation logic — strong coverage: `meals.test.ts`, `weight.test.ts`, `goals.test.ts` (domain), `meals.test.ts`/`settings-goals` (repository), and nav-level integration tests (`calories-macros.nav.test.tsx`, `meals.nav.test.tsx`, `units-weight-goal.nav.test.tsx`, `weight.nav.test.tsx`, `profile.queries.test.tsx`) covering UX-01 first save, DATA-04 units-apply-everywhere, and the move-entries sheet.
- [x] M8 extra — meal delete+reassign transaction rollback: `src/data/db/repositories/__tests__/meals.test.ts:91` fails the compaction step via a trigger and asserts meals/entries/recents are byte-identical to the pre-transaction snapshot. Also verified live on-device (see below): deleting Lunch (3 entries) with target Dinner correctly reassigned all 3 entries, compacted sort_order, and the Diary now shows them under Dinner.
- [x] Maestro flows both platforms: `m8-reorder-meals.yaml` and `m8-weight.yaml` — **PASS** on Android (`emulator-5554`) and iOS (`iPhone 17e`), all 4 runs, via `scripts/e2e.sh`.
- [x] No placeholder UI — every Profile row is wired (`ProfileScreen.tsx` only shows a chevron when a handler exists).
- [x] Known gaps listed in `docs/progress.md` — hardware back after `ConfirmationDialog` (pre-existing) and no-live-shift during meal drag, both judged pre-existing/cosmetic, not blockers.
- [x] ARCH-15 — no logger calls anywhere in the touched profile/weight/meals code path; grepped `src/features/profile`, the four changed repositories, and found zero `logger.*`/`console.*` calls carrying weights, names, or rows.

## Findings

1. **minor** — `docs/04-architecture.md` ARCH-22 ("Component tests run in en, plus one render smoke test per screen in pt-PT to catch overflow and missing keys") is listed as touched by M8 but none of the 7 new/changed screen test files carry a pt-PT smoke render, unlike every prior milestone's screen tests (e.g. `src/features/diary/__tests__/QuickCaloriesScreen.test.tsx:102` `ARCH-22: pt-PT smoke render`).
   - Files: `src/features/profile/screens/__tests__/CaloriesMacrosScreen.test.tsx`, `MealEditScreen.test.tsx`, `MealsScreen.test.tsx`, `ProfileScreen.test.tsx`, `UnitsScreen.test.tsx`, `WeightGoalScreen.test.tsx` (all 0 pt-PT-locale render tests); no `WeightHistoryScreen.test.tsx` exists at all (only exercised via `weight.nav.test.tsx`, in `en`).
   - Repro: `grep -c pt-PT` on any of those files returns 0; the one pt-PT match in `weight.nav.test.tsx:136` is a unit-formatting assertion (`formatWeightChange`), not a rendered screen.
   - Impact: the `en`/`pt-PT` key-parity test (`locales.test.ts`) still passes, so no missing keys, but nothing catches pt-PT overflow/wrapping on these 7 screens before ship. Not a blocker since it's a test-coverage gap, not an observed runtime defect — recommend adding the smoke tests in M9's DS-13/pt-PT pass or before, per ARCH-22.

## Notes / non-findings
- Manually drove the meal delete+reassign flow (not covered by Maestro) on the Android emulator: Profile → Meals → Lunch → Delete meal → picked Dinner → `Delete and move entries` correctly removed Lunch, moved its 3 entries to Dinner (Diary confirms 381 kcal = Quick Calories 250 + 12 large eggs 131), and compacted the meal list to Breakfast/Dinner/Snacks. This left the emulator's app data in that post-delete state (no device *settings* were changed, so nothing to reset per the review rules).
- Copy in `en.json` matches the UX-14/15/16/17/18/19 wireframes and dialog table verbatim (titles, error strings, dialog bodies).
- UX-00 dirty-exit rule (`Discard changes?` only for Calories & Macros here) is correctly scoped: Meal Edit, Units, Weight Goal, Weight Entry Sheet silently discard; Calories & Macros wires `ExitGuardHook` via `usePreventRemove` so system back / swipe-back share the app-bar-back path (ARCH-06), confirmed by `calories-macros.nav.test.tsx`'s dedicated system-back test.
- iOS simulator screenshot tool was intermittently failing during this review (`captureFailed`); relied on the passing Maestro iOS runs plus the Android manual pass instead of spending the time budget retrying it.
