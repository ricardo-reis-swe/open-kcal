# M7 Meal Detail + copy — independent review

> **Superseded 2026-09-28** (commit `d786ee8`, user request): Meal Detail (UX-03) was removed and copy moved to the Diary `…` menus with a date-then-meal Copy Sheet (UX-02, UX-12). This review describes the original M7 build and is kept as history.

Reviewed HEAD: `9060795b76f7322ebfaee271ba8915f7efbc7698`
Commit range: `6c78c1a..HEAD` (bc3c5f5, e69e986, 9060795)

## Verdict: pass

Main specs (UX-03, UX-12, NAV-07, DATA-16) are implemented as documented, `npm run check` is green, focused tests
cover the domain/data/navigation logic, and the exit demo (copy a meal to tomorrow and to a picked date, return
rules hold) works end to end on the Android emulator. No blockers or majors found.

## ROAD-02 checklist

- [x] Main specs implemented (UX-03/12, NAV-07, DATA-16) — traced to `MealDetailScreen.tsx`, `CopyMealFlow.tsx`,
      `diaryRepository.copyMeal`; verified by hand on Android (copy to tomorrow + to a picked date, toast, totals,
      back → Diary same date).
- [x] `npm run check` green — exit code 0, 63 suites / 429 tests passed.
- [x] Focused tests for changed domain/data/navigation logic — `copy-meal.test.ts` (exact snapshots, order, append,
      same-date duplicates, independence, rollback, unknown-meal/invalid-date rejection), `meal-detail.nav.test.tsx`,
      `CopyMealFlow.test.tsx`.
- [x] Android Maestro flow: n/a — M7 adds none per the ARCH-18 table; confirmed `.maestro/` has no M7 flow.
- [x] Every string in `en` + `pt-PT` — `mealDetail.*` and `copyMeal.*` keys present and parallel in both locale
      files (`src/shared/i18n/locales/{en,pt-PT}.json:265-280`); `locales.test.ts` (key-set parity) passes.
- [x] No placeholder UI for in-scope behavior — no TODO/FIXME in the new screens/repo code; Meal Detail, Copy Meal
      Sheet and the copy transaction are fully wired.
- [x] Known gaps listed — `docs/progress.md` §M7 lists the two gaps below.
- [x] Nothing sensitive in logs (ARCH-15) — no `logger`/`console` calls added in `CopyMealFlow.tsx`,
      `MealDetailScreen.tsx`, or `diaryRepository.ts`; errors surface only as translated UI toasts.

## Manual exit demo (Android emulator-5554, HEAD build reused)

1. Diary → Breakfast header → Meal Detail: date shown as long form ("Monday, September 28"), total, entry list, Copy
   meal enabled (UX-03).
2. Copy meal → sheet titled "Copy Breakfast to", rows Today/Tomorrow/Choose date… (UX-12).
3. Tomorrow → toast "Copied 1 item to Breakfast, Tue, Sep 29", stayed on source Meal Detail, source total unchanged
   (298 kcal); Diary on Tue Sep 29 then showed Breakfast at 596 kcal (298 + copy) — copy landed in the same meal on
   the destination date, source untouched (DATA-16, NAV-07).
4. Copy meal → Choose date… → native Android date picker (Cancel/Done/Today) → picked Sep 5 → Done → toast "Copied 1
   item to Breakfast, Sat, Sep 5"; Diary on Sep 5 showed the copied 298 kcal entry (UX-13/NAV-07).
5. Back from Meal Detail → Diary, same date (source), per NAV-04.

iOS: the installed dev build on the booted simulator (iPhone 17e) crashes at startup with `NativeModule.RNCNetInfo
is null` (native module not linked in that build) — unrelated to this milestone (no native deps touched in
`6c78c1a..HEAD`) and not a ROAD-02 gate (iOS device/simulator testing is deferred unless explicitly requested).
Rebuilding was out of scope for the ~5 minute cap on manual iOS verification; Android + the full component/navigation
test suite give equivalent coverage of the same JS/TS logic. Flagged for the orchestrator's awareness, not as an M7
finding.

## Spec trace notes

- NAV-04's "opened from Meal Detail and meal changed → Diary" exception for Edit Food Entry / Edit Quick Calories was
  already implemented pre-M7 (`FoodDetailScreen.tsx:250`, `QuickCaloriesScreen.tsx:188`) in anticipation of the
  `mealDetail` origin; M7's `meal-detail.nav.test.tsx` exercises it end to end and it holds.
- UX-13 "Destination mode only changes the title": on Android, `DatePicker.tsx`'s `AndroidDatePicker` doesn't pass
  any title at all (not new to M7 — the file is unchanged in this range). This is a library trade-off, not an
  oversight: `@react-native-community/datetimepicker`'s Android `title` option is "Material 3 only", and Material 3
  drops `neutralButton` support, which the Today shortcut needs (UX-13 MUST). Since it predates M7 and isn't part of
  this diff, it's not raised as an M7 finding.

## Known gaps (already logged in `docs/progress.md`, judged here)

1. **Minor** — `en` short dates use the device `Intl` weekday/month/day order (e.g. "Fri, Sep 25") instead of the
   UX-02/UX-12 example order ("Fri 25 Sep"). Reproduced on Android in the Copy Meal Sheet ("Today · Mon, Sep 28").
   Same formatter as the Diary since M2 (`src/shared/i18n/format.ts:59-69`, `formatShortDate`), so not a new M7
   regression; it's locale-dependent (en-GB renders "Fri 26 Sept", matching the spec order) and is explicitly
   asserted in `CopyMealFlow.test.tsx:40-41`, i.e. tested-as-is rather than hidden. Cosmetic only — the correct date
   is always identified unambiguously.
2. **Not a gap** — the Date Picker `Today` a11y hint text is unconditionally `datePicker.todayHint` regardless of
   mode (`DatePicker.tsx:114-118`). UX-13 explicitly says destination mode "only changes the title," so the hint
   staying put is spec-conformant, not a deviation; the progress log entry is informational only.

## Files touched (for reference)

- `src/data/db/repositories/diaryRepository.ts` (`copyMeal`, DATA-16)
- `src/features/diary/screens/MealDetailScreen.tsx` (UX-03)
- `src/features/diary/components/CopyMealFlow.tsx` (UX-12/UX-13/NAV-07)
- `src/features/diary/diary.queries.ts` (`useDiaryMeal`, `useDiaryWrites().copyMeal`)
- `src/shared/navigation/routes.ts`, `src/app/(tabs)/diary/meal/[mealId].tsx` (NAV-04/NAV-09)
- `src/shared/i18n/locales/{en,pt-PT}.json` (`mealDetail.*`, `copyMeal.*`, ARCH-22)
- Tests: `src/data/db/repositories/__tests__/copy-meal.test.ts`,
  `src/features/diary/__tests__/meal-detail.nav.test.tsx`, `src/features/diary/__tests__/CopyMealFlow.test.tsx`,
  `src/shared/navigation/__tests__/food-routes.test.ts`
