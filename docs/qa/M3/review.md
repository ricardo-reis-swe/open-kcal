# M3 Quick Calories: independent review, round 1 (full)

- **Verdict: not clean** (1 major, 4 minor, 0 blockers)
- **HEAD reviewed:** `0617424` (range `9297f1f..0617424`, 2 commits: `47c807c` feature, `0617424` QA screenshots)
- **Reviewer:** a separate agent with fresh context, read-only. The only file it wrote is this report (ROAD-03).
- **Specs traced:** UX-07, UX-09, UX-10, UX-19, NAV-03, NAV-04, NAV-08. Also checked: UX-00, NAV-05, NAV-09, ARCH-03/06/07/08/13/15/18/22, DS-11/12, DATA-04/06/12/16, SCOPE-10 / post-mvp.

## What was run
| Check | Result |
|---|---|
| `npm run check` (lint + `tsc` + Jest) | exit **0**: 45 suites, **309 tests** passed. Noise: one `act(...)` warning from `DiaryScreen.test.tsx` and "A worker process has failed to exit gracefully". Neither file is in the M3 range; see Notes. |
| `scripts/e2e.sh android` (emulator-5554) | `E2E android: PASS (190s, exit 0)`: m2-launch-today, m2-swipe-date, m3-quick-calories, m0-shell (4/4) |
| `scripts/e2e.sh ios` (iPhone 17e) | `E2E ios: PASS (115s, exit 0)`: same 4 flows (4/4) |
| Exit demo, Android (`scripts/android-drive.sh`) | Pass, except M3-R1. See below. |
| Exit demo, iOS (a throwaway Maestro flow in the reviewer's scratchpad, not in the repo) | Pass, except M3-R1. See below. |
| QA screenshots (`docs/qa/M3/`, 48 files + README) | Reviewed: android-light-default-quick-calories, android-dark-largest-add-sheet, android-light-largest-edit, ios-light-largest-quick-calories-error, ios-light-largest-delete-dialog, ios-dark-default-meal-picker |

### Exit demo observations
- **SCOPE-11 flow 2**: the Maestro `m3-quick-calories` flow covers `+` → Quick calories → Lunch → 450 → Add → Diary. It then edits the entry (500 → Save → Diary) and deletes it (confirm → gone). It passed on both platforms.
- **`+` from Profile on another date** (both platforms): Diary → Tomorrow → Profile → `+` → Quick calories → Dinner. The screen shows `Date, Sat, Sep 26` (Tomorrow), which is correct.
- **Back from that screen** (both platforms): it lands on the **Diary tab** (Tomorrow), not on Profile. Nothing is saved. See M3-R2.
- **Validation** (both platforms): typing `0` and moving to Note shows `Enter a whole number from 1 to 10,000 kcal.` (iOS: `10 000`, device locale). Add/Save stays disabled. The message clears once the value is valid.
- **Edit with a meal change** (Android): Lunch 123 → `0` shows the error → 250 → Meal row → picker checks nothing extra; Lunch is the current meal → Dinner → Save. The result is Diary / Tomorrow with `Lunch, 0 kilocalories` and the entry under Dinner.
- **Delete** (Android): the dialog reads `Delete quick calories?` / `250 kcal from Dinner on Sat, Sep 26.` with `Cancel` and `Delete entry`. Cancel keeps the screen. Confirm returns to the Diary, and Dinner goes back to its seeded 2,100 kcal.
- **`+` while Quick Calories is open** (both platforms): the second pick is ignored. See M3-R1.
- **Not run on a device:**
  - kJ input. It needs a Units change, and the Units screen is M8. Changing `app_settings` by hand would alter user settings. kJ is covered by the component and domain tests.
  - The Meal Detail exception in NAV-04. The route doesn't exist until M7.
- **Cleanup:**
  - The Android demo created one entry by accident (123 kcal, Lunch, Tomorrow). It was used for the edit and delete demo and then deleted through the UI.
  - Afterwards, both DBs hold only the three dev-seed Quick Calories rows (checked with `sqlite3`).
  - No device settings were changed: Android font scale 1.0, night mode off, physical display size.
  - No app data was cleared.

## ROAD-02 checklist
- [ ] Every Main-spec behavior implemented. **One wrong behavior found (M3-R1).**
- [x] `npm run check` green (exit 0).
- [~] Tests at the right ARCH-18 layer:
  - Domain: unit tests.
  - Writes: repository tests from M1 on real SQLite.
  - Screen: component tests (add mode).
  - Routes: navigation tests on real SQLite.
  - Gaps: see M3-R5.
- [x] Test names cite spec IDs (every new test in the range does).
- [x] Every new string is in `en` and `pt-PT`. The parity test passes (`locales.test.ts:25`), the pt-PT smoke render passes, and the wording is European Portuguese.
- [x] Maestro `m3-quick-calories` passes on iOS and Android. M0/M2 flows stay green.
- [x] Exit demo run on both platforms. Screenshots for light/dark × default/largest on a small phone are in `docs/qa/M3/` with a README index.
- [x] No placeholder UI for in-scope behavior. `Add food` and `Update weight` are disabled until M4/M8 and logged as known gaps.
- [x] Nothing sensitive in logs (ARCH-15). The range adds no logger calls. Save/delete failures are caught without logging the note or kcal.

## Findings

### Major

**M3-R1 (major): pressing `+` while Quick Calories is open ignores the new meal pick, so Add writes to the old meal. NAV-03, UX-10, UX-07.**
- Where:
  - `src/features/diary/components/GlobalAddFlow.tsx:25-26` uses `router.navigate(...)` to the same route.
  - `src/features/diary/screens/QuickCaloriesScreen.tsx:66` keys the form `'add'` for every add.
  - `QuickCaloriesScreen.tsx:108` seeds `mealId` state once from `initialMealId`.
- The tab bar stays visible on the Quick Calories screen, so `+` can be pressed there (`ios-*-quick-calories-error.png` shows it).
- Reproduced on both platforms:
  1. `+` → Quick calories → Lunch.
  2. Type `77`.
  3. Press `+` again → Quick calories → **Snacks**.
- Result: the same screen stays, with **Meal: Lunch** and `77` still typed. `navigate` updated the existing route's params in place: one Back returns to the Diary. The keyed-`'add'` form kept its state.
- Pressing Add would log the entry to Lunch although the user just chose Snacks. That is a silent wrong-meal write. NAV-03 says `+` → Meal Picker → Quick Calories for the picked meal.
- The same stale state applies to `mode.date` versus the form, though the date can't change while the screen is open today.
- Fix:
  - Open a fresh screen for each global add. Either use `router.push`, or dismiss to the Diary root and then push. Alternatively, key the form on `${mode.mealId}:${mode.date}` so new params reset it.
  - Add a navigation test: open Quick Calories (Lunch), `+` → Quick calories → Snacks, and assert `Meal, Snacks` and an empty Calories field.

### Minor

**M3-R2 (minor): Back from a Quick Calories screen started on Profile lands on the Diary tab, not on Profile. NAV-09 (`origin` decides where save/cancel return), NAV-03.**
- Where: `GlobalAddFlow.tsx:26` always passes `origin: 'diary'`. The screen's back is a plain `router.back()` (`QuickCaloriesScreen.tsx:82`) inside the Diary stack.
- Reproduced on both platforms: Profile → `+` → Quick calories → Dinner → Back leaves the user on Diary / Tomorrow. Nothing is saved.
- NAV-03 only pins the **save** end ("ends on Diary … even when started from Profile"). NAV-09 lists `Profile` as an origin for save/cancel. So cancel-from-Profile returning to Diary is at least unstated, and arguably wrong.
- The nav test `quick-calories.nav.test.tsx:124` only covers back from a Diary start.
- Fix: ask the user which is intended. If Profile, pass `origin: 'profile'` from `GlobalAddFlow` when the Profile tab is focused, and on back/cancel with that origin switch to the Profile tab. If Diary, write it into NAV-03.

**M3-R3 (minor): the Quick Calories form doesn't use React Hook Form + a Zod submit schema. ARCH-03.**
- Where: `QuickCaloriesScreen.tsx:108-135` uses hand-rolled `useState` fields and flags. `src/domain/diary/entries.ts:41-48` validates with a regex. `react-hook-form` is not a dependency (`package.json`).
- ARCH-03 names Quick Calories explicitly: "React Hook Form for multi-field and validated forms, including: Quick Calories". It also requires Zod validation on form submits.
- The behavior is correct and tested. This is an unapproved architecture deviation, and later forms (custom food, goals, weight) will copy the pattern.
- Fix: adopt RHF + a Zod schema that wraps `parseQuickCaloriesInput`, or get the user's approval and amend ARCH-03.

**M3-R4 (minor): a DB load failure on Quick Calories shows "This item no longer exists." UX-00, ARCH-13.**
- Where: `QuickCaloriesScreen.tsx:76-78`. A failure of `useAppSettings`, `useMeals` or a non-NotFound `useDiaryEntry` error falls through to the not-found state.
- Scenario: a transient SQLite read error (for example `DatabaseError` from a busy WAL) on opening Quick Calories tells the user the item was deleted. There is no Retry.
- UX-00 reserves not found for bad params or a record deleted elsewhere. ARCH-13 says user messages describe recovery, and UX-02 already uses a full-screen error with Retry for load failures.
- Fix: render an error state with Retry (reuse the Diary's) for non-NotFound errors, and keep `NotFoundState` for `NotFoundError` and bad params. Add a component test for it.

**M3-R5 (minor): gaps in test coverage. ARCH-18, ROAD-02 ("Tests exist for everything built").**
- **UX-10 single-meal skip**: `GlobalAddFlow.tsx:41` (`list.length === 1` → skip the picker) has no test. Seeding a DB with one meal in a nav test would cover it.
- **Edit mode has no component tests** (`QuickCaloriesScreen.test.tsx` renders add mode only). Untested:
  - The populated edit state and a11y labels.
  - The delete-failure path (`QuickCaloriesScreen.tsx:159-169`, `Couldn't delete. Try again.`).
  - The kJ "untouched field keeps the stored unrounded kcal" rule (`:146`).
  - An edit route for a **food** entry ID showing not found (`:56`).
- Fix: add these cases, citing UX-07 / UX-00 / DATA-04 in the test names.

## Spec trace

| Rule / bullet | Code | Tests |
|---|---|---|
| UX-09 rows `Add food` · `Quick calories` · `Update weight`, icon + label, no title | `src/shared/navigation/AddActionSheet.tsx:19-43` | `quick-calories.nav.test.tsx:45-58` |
| NAV-03 available from both tabs | `src/app/(tabs)/_layout.tsx` (GlobalAddFlow + DiaryDateProvider above both tabs) | nav `:106-122` |
| NAV-03 picking an action closes the sheet before the next sheet/route | `GlobalAddFlow.tsx:33-60`; `BottomSheet.tsx` `onDismissed`/`finishClose` | nav `:60-74`; `overlays.test.tsx` onDismissed test |
| NAV-03 dismiss: swipe, outside, back (one cancel path) | `BottomSheet.tsx:138,147` (M0) | nav `:76-85` (backdrop) |
| NAV-03 global flow ends on Diary on the target date, even from Profile | `QuickCaloriesScreen.tsx:139-143` | nav `:87-104`, `:106-122`; device ✓ |
| NAV-03 uses the selected diary date | `GlobalAddFlow.tsx:18,26`; `DiaryDateContext.tsx` | nav `:106-122`; device ✓ |
| NAV-03 picker skipped when a meal is in context | N/A in M3 (no meal-specific entry until Food Search, M4) | — |
| NAV-03 no barcode | `AddActionSheet.tsx:19-23` | nav `:57` |
| NAV-03 `+` → Meal Picker → Quick Calories for the picked meal | `GlobalAddFlow.tsx:25-26` | **M3-R1** |
| UX-10 `Choose meal` compact title | `MealPicker.tsx:34-40` | nav `:67` |
| UX-10 meals in saved order, never fixed names | `MealPicker.tsx:42-71`; `useMeals` `diary.queries.ts:28-31` | nav `:68-73` |
| UX-10 check on current meal when changing | `MealPicker.tsx:43,50,67`; `QuickCaloriesScreen.tsx:263-272` | nav `:157-161` |
| UX-10 tap = select + close | `MealPicker.tsx:47`; callers close | nav `:151-172` |
| UX-10 exactly one meal → skip | `GlobalAddFlow.tsx:41` | **none (M3-R5)** |
| UX-07 layout Meal → Calories → Note → Date → Add | `QuickCaloriesScreen.tsx:183-261` | component `:36-45` |
| UX-07 Calories focused on open, integer, 1–10,000 kcal in energy unit | `:199,203`; `entries.ts:29-48` | component `:47-78`; `entries.test.ts` |
| UX-07 Note single line, optional, 0–80 | `:207-216`; `entries.ts:26`; repo trims (`diaryRepository.ts:335,355`) | component `:42`; nav `:96,101` (trim) |
| UX-07 Edit: title `Edit quick calories`, `Save`, `Delete entry` | `:48,224-236,254` | nav `:137-149,174-197` |
| UX-00 primary pinned, disabled until valid / changed | `:121,238-261` | component `:56,60`; nav `:92,146-148` |
| UX-00 validation on blur + submit, clears when valid | `:123-135,197` | component `:47-62`; device ✓ |
| UX-00 Return → next; last field submits | `:200-201,213-214` (iOS number pad has no Return; logged) | — |
| UX-00 energy field follows `energy_unit` | `:117,194`; `entries.ts:29-48` | component `:64-78` |
| UX-00 save failure inline, input kept | `:152-156,246-252` | component `:80-89` |
| UX-00 not found + back to root | `:51-61`; `NotFoundState.tsx` | nav `:199-214` |
| UX-00 load error | `:76-78` | **M3-R4** |
| UX-00 dirty exit silently discards | `:82` (`router.back`) | nav `:124-133` |
| NAV-04 Quick Calories: Add → origin (global = Diary), totals refreshed | `:139-143`; `diary.queries.ts:43-64` | nav `:87-104` |
| NAV-04 Edit: Save → exact origin; Meal Detail + meal change → Diary | `:148-150` (Meal Detail arrives in M7) | nav `:151-172` (Diary origin) |
| NAV-04 Delete → confirm → origin, totals refreshed | `:159-169`; `diary.queries.ts:56-63` | nav `:174-197`; device ✓ |
| NAV-04 Diary quick row → Edit Quick Calories | `DiaryDay.tsx` (MealSection `onPress` → `routes.editQuickCalories`) | nav `:137-149` |
| NAV-08 / UX-19 dialog names the object, destructive distinct, `<kcal> from <meal> on <date>.` | `:273-292`; `ConfirmationDialog.tsx` | nav `:180-197`; device ✓ |
| NAV-09 IDs + light context only; Zod param validation | `routes.ts` (`paramSchemas`, builders) | nav `:199-214` |
| NAV-09 origin decides where save/cancel return | `GlobalAddFlow.tsx:26` | **M3-R2** |
| ARCH-06 typed builders, date context above stacks | `routes.ts`; `(tabs)/_layout.tsx` | — |
| ARCH-07/08 commit → invalidate → refetch before resolve; no optimistic display | `diary.queries.ts:39-64` | nav tests assert fresh totals right after return |
| ARCH-03 RHF + Zod form | not used | **M3-R3** |
| ARCH-15 no sensitive logging | no logger calls added | — |
| ARCH-22 en + pt-PT keys, no concatenation | `en.json` / `pt-PT.json` (`quickCalories.*`, `mealPicker.*`, `addActions.*`, `common.notFound/backToDiary`) | `locales.test.ts:25`; component `:91-97` |
| DATA-04 canonical kcal, unrounded | `entries.ts:47`; `:146` keeps the stored value | component `:64-78` |
| DATA-06 macros NULL, note trimmed / empty → NULL | `diaryRepository.ts:318-343` | `entries.test.ts`; repo tests (M1) |
| DATA-12 meal move changes only `meal_id`; physical delete | `diaryRepository.ts:345-367` | repo tests (M1); nav `:151-197` |

## Traced without findings
- **Write/invalidate ordering**: `onSuccess` returns the invalidation promise, so `mutateAsync` resolves only after every `['diary', …]` query has refetched. Delete removes the entry's own query first, so it can't refetch into a not-found error (`diary.queries.ts:56-63`).
- **kJ ↔ kcal**:
  - The range is 5–41,840 kJ, with an epsilon guard.
  - Parsing is integer-only (`^\d{1,6}$`), with `maxLength 6`.
  - An untouched edit keeps the stored unrounded kcal, so there is no drift.
- **Double submit**: `busy` disables the primary and the delete action during a write.
- **Deleted entry**: an edit route for a missing ID shows not found. A food-entry ID also shows not found (code; untested, M3-R5).
- **SCOPE-10 / post-mvp**: no barcode, no leaks.
- **DS-11 / DS-12**:
  - Uses the shared `BottomSheet`, `ListRow`, `FormField`, `PrimaryButton`, `TextAction` and `ConfirmationDialog`.
  - Picker rows expose `selected`.
  - The meal row has a hint.
  - At the largest text sizes the dialog actions wrap instead of clipping.
  - The app-bar truncation at iOS AX5 is a logged known gap.
- **QA script** (`scripts/qa/m3.sh`): it resets appearance, text size and display size, and it restores the dev-client FAB default. This addresses M2-R7.

## Notes (not findings)
- `npm run check` prints an `act(...)` warning from `DiaryScreen.test.tsx` and a Jest "worker failed to exit gracefully" message. Neither file changed in this range and the exit code is 0. It is worth a look before the output hides a real warning.
- `QuickCaloriesMode.add.origin` is parsed but unused: add always ends on the Diary, which is correct for global `+`. When Food Search (M4) opens Quick Calories with a meal in context, NAV-04 "Add → origin" and "back returns here" (UX-04) will need it.
