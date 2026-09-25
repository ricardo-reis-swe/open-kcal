# M2 Diary (read): independent review, round 1 (full)

- **Verdict: not clean** (1 major, 7 minor, 0 blockers)
- **HEAD reviewed:** `69a6673` (range `7ef1cf8..69a6673`, 6 commits)
- **Reviewer:** a separate agent with fresh context, read-only. The only file it wrote is this report (ROAD-03).
- **Specs traced:** UX-02, UX-13, NAV-02, NAV-05, DS-07, DS-08. Also checked: UX-00 (number display), UX-01 (default-goals row), DATA-06, DATA-09, DS-02, DS-11, ARCH-06/07/15/18/20/22, SCOPE-10 / post-mvp.

## What was run
| Check | Result |
|---|---|
| `npm run check` (lint + `tsc` + Jest) | exit **0**: 41 suites, **265 tests** passed |
| `scripts/e2e.sh android` (emulator-5554) | `E2E android: PASS (74s, exit 0)`: m2-launch-today, m2-swipe-date, m0-shell |
| `scripts/e2e.sh ios` (iPhone 17e, iOS 27) | `E2E ios: PASS (76s, exit 0)`: same 3 flows |
| Exit demo, Android (`scripts/android-drive.sh`) | Pass, see below |
| Exit demo, iOS (a throwaway Maestro flow in the reviewer's scratchpad, not the repo) | Pass (`E2E ios: PASS (33s, exit 0)`), see below |
| QA screenshots (`docs/qa/M2/`, 32 files) | Reviewed: android light/dark default today + over goal, android largest today + over goal, iOS dark default today, iOS largest today + date picker |

### Exit demo observations (both platforms)
- **Today** (dev seed): ring `783 kcal left / 1,217 eaten`. Every macro has an info icon, and its label says "Some entries have unknown …". The default-goals row shows. Food rows and the Quick Calories row (`Canteen lunch`, then `Quick Calories`, label "Macros unknown") render.
- **Swipe left → Tomorrow**: the ring shows "Over calorie goal by 405 kilocalories. Goal 2,000, 2,405 eaten." It is a full warning-color ring with `kcal over`, and `Go to today` appears.
- **Swipe again → Sun 27 Sep (empty)**: Breakfast, Lunch, Dinner and Snacks each show 0 kcal and `Add food to …`.
- **Scroll to top on day change**: scrolled Tomorrow down, swiped to Sep 27, which opened at the top. Prev returned to Tomorrow at the top.
- **Prev/next buttons and `Go to today`** each move one day or return to today.
- **Past days** (Yesterday, Wed 23 Sep): "No goal for this date" (DATA-09, logged as a known gap). Yesterday shows known macros only (`Carbs, 3.2 grams.`).
- **Date Picker**:
  - Android: the dialog opens on the active date (Wed, Sep 23). Picking 12 Sep → DONE → "Showing Sat, Sep 12". Reopened on Sep 12. Moving to next month, picking 15 Oct and pressing CANCEL leaves the date on Sep 12. TODAY → "Showing Today".
  - iOS: Cancel keeps Yesterday. Today → Today, and `Go to today` is gone. Picking Saturday, 12 September → Done → "Showing Sat…12…".
- **NAV-02**: on Android, tapping the Diary tab at the root after scrolling returns the list to the top.
- **DS-02 density** (`android-light-default-today.png`, 360 dp): app bar + date strip, ring, 3 macros, default-goals row, Breakfast + Lunch headers, 2 food rows and the bottom nav are all visible. **Pass.** The overview without the status row is about 218 dp, inside DS-08's 210–224.
- **Dark mode and largest text**: structure is kept, the macro strip stacks, and the date strip becomes chevrons. One overlap on iOS AX5 (M2-R4).
- No device settings were changed. Android font scale is 1.0, night mode is off and the display is at its physical size. No app data was cleared.

## Findings

### Major

**M2-R1 (major): "Today" goes stale while the app stays alive, so the Diary labels the wrong day. UX-02, NAV-05.**
- Where: `src/features/diary/hooks/DiaryDateContext.tsx:19-22`, used by `src/features/diary/components/DiaryDateStrip.tsx:21-22,93`.
- The problem: `today` is computed only when `DiaryDateProvider` renders. Nothing re-renders the provider on app resume or at midnight. Its inputs are its own `date` state and a stable services context.
- The effect: suppose the app is left open or backgrounded overnight, which is common on iOS. The next morning, yesterday's diary is still labeled **Today**. The Today button is hidden because `date === today`. Prev/next labels are off by one.
- UX-02 says the Yesterday/Today/Tomorrow labels are relative to the real today. This breaks that rule. Once M3 adds logging, entries would silently land on the wrong day.
- The progress log lists this as a known gap ("updates on the next render"). That understates it: the next render only happens when the user changes the date. A known gap is not a user-approved deviation (ROAD-02).
- Fix:
  - Keep `today` in provider state.
  - Refresh it on `AppState` → `active`, and with a timer set for the next local midnight.
  - Add a test with a fake clock that advances past midnight and fires `AppState` `change`. The labels must update.
  - Whether the *selected* date should also jump to the new today on resume is not in the spec (NAV-05 only covers a fresh launch). Ask the user rather than decide.

### Minor

**M2-R2 (minor): an all-unknown macro shows as a known 0, and the label says "Some entries". DATA-06, UX-00.**
- Where: `src/features/diary/components/MacroStrip.tsx:43-50,65`. The aggregate at `src/data/db/repositories/diaryRepository.ts:101-103` turns a NULL `known_*` sum into `0`.
- The problem: on a day with only Quick Calories, the strip shows `0/100 g` and says "Some entries have unknown protein". It is really *all* of them, and the total is unknown, not 0.
- This case is covered by the test at `DiaryScreen.test.tsx:81`.
- Fix: when `unknownCount === entryCount > 0`, render `—/100 g` and a label such as "Protein unknown" (UX-00: `—`, spoken "unknown"). Keep the info icon for the partial case.

**M2-R3 (minor): translated strings are joined by concatenation. ARCH-22 ("No concatenation: use interpolation").**
- Where: `MacroStrip.tsx:65` (`${base} ${t(macro.unknown)}`) and `DiaryDateStrip.tsx:54,89` (`‹ ${label}`, `${label} ›`).
- Fix: use interpolated keys, e.g. `diary.macros.a11yPartial` = `{{base}} {{unknown}}`, or full sentences per case. Use `diary.prevLabel` = `‹ {{label}}` and `diary.nextLabel` = `{{label}} ›`, with the pt-PT equivalents.

**M2-R4 (minor): at iOS AX5 the ring's text overlaps the ring stroke. DS-11 ("never clip"), DS-01 (no overlaps). Tokens not used (DS-12).**
- Where: `src/features/diary/components/CalorieRing.tsx:83`. The content box is the full square minus `STROKE + spacing`.
- The problem: in `ios-light-largest-today.png`, the "1 217 eaten" line runs into the stroke on both sides, because a lower line sits on a shorter chord of the circle. Android at 2.0 is fine.
- Also, `CalorieRing.tsx:17-18` hard-codes 140/9 instead of `theme.sizes.calorieRing`.
- Fix: inset the text to the inscribed square, `padding = diameter * (1 - 1/√2) / 2 + stroke`, or let lines below the centre shrink to fit at large sizes. Read the diameter and stroke from the tokens.

**M2-R5 (minor): the pager's swipe logic has no test below E2E. ARCH-18, UX-02.**
- Where: `src/features/diary/components/DiaryPager.tsx:39-45`.
- The problem: the Android double momentum-end fix and the page → date mapping are only covered by Maestro.
- Also, a drag released exactly on a page boundary may not fire `onMomentumScrollEnd` on iOS. That leaves `dragging` set and the date unchanged while the next page is on screen.
- Fix:
  - Add a component test: begin drag → momentum end at `2*width` calls `onChange(next)` once, and a second momentum end without a drag is ignored.
  - Also resolve the page in `onScrollEndDrag` when the offset is already page-aligned.

**M2-R6 (minor): the dev-seed gating is not tested. ROAD-01 M2 (dev-only), ARCH-18.**
- Where: `src/bootstrap/start-services.ts:57` and `src/shared/config/env.ts:56`.
- The problem: `devSeed.test.ts` only tests the seed itself. No test shows that `startServices` skips it when `EXPO_PUBLIC_DEV_SEED_DIARY` is unset or `0`, or when `__DEV__` is false. `env.test.ts` never parses `'1'`.
- Fix: add `parseConfig({ EXPO_PUBLIC_DEV_SEED_DIARY: '1' })` → `true`, and a `startServices` test with the flag off (and `__DEV__` false) that asserts no sample food exists.

**M2-R7 (minor): the QA script leaves an iOS simulator setting changed. ROAD-02 QA hygiene.**
- Where: `scripts/qa/m2.sh:21` writes `EXDevMenuShowFloatingActionButton -bool NO` into the app's defaults. `reset_device` never restores it, although the header says "Device settings are reset on exit".
- Fix: `defaults delete $PKG EXDevMenuShowFloatingActionButton` in `reset_device`, or say in the comment that it persists.

**M2-R8 (minor): a test name doesn't cite a spec ID. ROAD-02 ("Test names cite spec IDs").**
- Where: `src/shared/navigation/__tests__/date-picker.test.tsx:96` (`'does not open while hidden'`).
- Fix: rename it `'UX-13: does not open while hidden'`.

## Traced without findings
- **UX-02**:
  - Layout order.
  - Calendar action labeled "Choose date".
  - Relative labels, and a locale short date with the year only when it differs.
  - Prev/next buttons.
  - Swipe with adjacent days pre-rendered; a new day opens at the top.
  - Empty meal = header (0 kcal) + Add food.
  - Full-screen error with Retry.
  - Focus order matches the visual order.
  - Actions for later milestones are disabled and logged as known gaps.
- **UX-13 / NAV-05**:
  - Opens on the active date; any date allowed (no min/max).
  - Done → Diary on that date; Cancel → no change; Today = the Today action.
  - The title prop covers destination mode.
  - Local noon avoids DST shifts.
  - The sheet handle, backdrop and Cancel share one path (ARCH-06).
  - The date lives in a Diary-scoped context above the stack and survives tab switches (nav test).
- **NAV-02**: tapping the tab at the root scrolls to the top. The listener is gated on `isFocused`, so a tab switch doesn't scroll (nav test + device).
- **DS-07 / DS-08**:
  - App bar + date strip family, selected underline, compact Today.
  - Ring: `kcal left`, eaten line, over-goal amount + `kcal over` + warning color + full SR label.
  - Macro strip: 3 fixed columns with color + text and an info icon for partial totals.
  - Meal header: the user's name is not uppercased.
  - Food and Quick Calories rows.
  - Add Food row.
- **UX-00**: grouped integer energy; macros shown as integers from 10 g and with 1 decimal below 10 g (tests in `format.test.ts`).
- **UX-01**: the row shows while `goals_confirmed_at` is NULL and is gone after a save (tests). Its `Set goals` action is deferred to M8, logged.
- **ARCH-15**: no new logging in the range. The dev seed logs nothing.
- **ARCH-20**: `@react-native-community/datetimepicker` 9.1.0 is pinned exactly, sits behind `DatePicker`, has a dependency note, and was approved in M2-Q1.
- **ARCH-22**:
  - All new keys exist in `en` and `pt-PT`, which read as European Portuguese.
  - The parity test passes.
  - The pt-PT smoke render passes.
- **SCOPE-10 / post-mvp**: no leaks found.
- **Dev seed**: gated on `__DEV__ && EXPO_PUBLIC_DEV_SEED_DIARY === '1'`, and idempotent (tested). `.env.example` defaults it to `0`.
