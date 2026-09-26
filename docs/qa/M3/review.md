# M3 Quick Calories: independent review, round 2 (delta)

- **Verdict:** no blockers or majors in the delta. M3-R4 remains one intentionally deferred minor.
- **HEAD reviewed:** `5e7e70701d024812ea27b26955ccd649b1af845b`.
- **Range reviewed:** `0617424..5e7e707` (`88aeff5`, `b1d67bb`, `6e1f55e`, `5e7e707`).
- **Independence:** separate reviewer with fresh context. This review inspected only the delta and prior review; it changed no product code, progress tracking, or commits. This report is the sole write.

## Checks and evidence

| Check | Result |
|---|---|
| `git diff --check 0617424..5e7e707` | Pass; no whitespace errors. |
| `npm run check` | Pass (exit 0): lint, `tsc`, 46 Jest suites / 318 tests. Existing test-output noise remains: expected startup-error logger output, `DiaryScreen.test.tsx` `act(...)` warnings, and Jest's forced-worker-exit notice. |
| `scripts/e2e.sh android` | Not runnable now: unrestricted ADB started successfully but reported `no devices/emulators found`. No device data was changed. |
| `scripts/e2e.sh ios` | Not runnable now: `xcrun: command not found`, so no simulator/Xcode tooling is available. |
| Exit demo / `scripts/android-drive.sh` | Not rerun: no Android device; no iOS device/tooling was available. |
| QA screenshots | Present and indexed in `docs/qa/M3/README.md`: both platforms, light/dark, default/largest, for action sheet, picker, validation/filled Quick Calories, edit, and delete dialog (48 PNGs). Round-1 device evidence remains four Maestro flows passing on both Android emulator-5554 and iPhone 17e, plus exit demos; it predates this delta. |

No Metro process was running during this review. The required current-HEAD device rerun remains operationally unverified, rather than failed by the application.

## Prior findings

| Finding | Status | Confirmation |
|---|---|---|
| M3-R1 (major) stale meal/input after a second global `+` | **Resolved** | `GlobalAddFlow.tsx:26-29` uses `router.push`, producing a fresh route/form. `quick-calories.nav.test.tsx:138-153` proves Lunch + typed input is replaced by fresh Snacks and writes Snacks only (NAV-03, UX-10, UX-07). |
| M3-R2 (minor) Profile-started cancel/back returned to Diary | **Resolved** | `GlobalAddFlow.tsx:19,29` records `profile` origin; `QuickCaloriesScreen.tsx:56-60` returns header-back to Profile while Add still ends on Diary. `quick-calories.nav.test.tsx:125-136` covers the Profile cancel path (NAV-03, NAV-04, NAV-09). |
| M3-R3 (minor) no RHF/Zod form boundary | **Resolved** | `QuickCaloriesScreen.tsx:120-143,230-267,304-310` uses React Hook Form and a resolver; `entries.ts:52-59` supplies the Zod schema, with domain coverage in `entries.test.ts` (ARCH-03). |
| M3-R4 (minor) load failure rendered as not-found | **Intentionally deferred minor** | Still present at `QuickCaloriesScreen.tsx:88-90`: settings/meals/non-not-found entry errors use `NotFoundState`, without Retry. Accurately logged for M9 in `docs/progress.md:246` (UX-00, ARCH-13). |
| M3-R5 (minor) missing coverage | **Resolved** | `GlobalAddFlow.test.tsx:29-54` covers one-meal picker skip. `QuickCaloriesScreen.test.tsx:110-187` covers populated edit, untouched-kJ fidelity, Meal Detail redirect, delete failure, and food-ID not found. The R1/R2 navigation cases are also covered above (ARCH-18). |

## ROAD-02 assessment

- [x] Main-spec delta behavior reviewed: M3-R1/R2 fixes preserve the selected date, fresh form state, Profile cancel, and Diary save end; M3-R3 follows ARCH-03.
- [x] `npm run check` green.
- [x] Appropriate domain, component, and navigation coverage was added; test names cite applicable spec IDs.
- [x] Existing locale parity and pt-PT smoke tests pass within the full check.
- [~] Current-HEAD Maestro and exit-demo reruns could not run because neither requested device environment is available. Prior both-platform evidence and screenshots exist, but do not replace a current rerun after UI/navigation changes.
- [x] Required light/dark/default/largest screenshot evidence exists under `docs/qa/M3/`.
- [x] No in-scope placeholder or SCOPE-10/POST leak found in the delta; no added sensitive logging (ARCH-15).
- [~] Known gap is logged: M3-R4 remains the single deferred minor.

## Findings

### Minor (deferred)

**M3-R4: Quick Calories maps a recoverable load failure to “This item no longer exists.” UX-00, ARCH-13.**

- `src/features/diary/screens/QuickCaloriesScreen.tsx:88-90` sends settings, meal, or non-`NotFoundError` entry-query failures to `NotFoundState`, offering `Back to Diary` rather than a recovery/retry path.
- This is intentionally deferred to the M9 error-state pass and accurately logged at `docs/progress.md:246`.

No new blockers, majors, or regressions were found in `0617424..5e7e707`.
