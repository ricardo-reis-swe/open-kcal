# M0 Skeleton — Independent review (ROAD-03)

- **Date:** 2026-09-25
- **Reviewer:** independent reviewer agent (fresh context)
- **Commit range:** `553efac..2aec263` (HEAD `2aec263`, 10 commits)
- **Scope:** ROAD-01 M0 row, ARCH-01/02/05/06/14/15/22, DS-12, NAV-01/02/03 (tab shell), ROAD-02 checklist + M0 extras

## Summary

**Verdict: not clean.** 0 blockers · 3 majors · 9 minors.

The skeleton is solid. `npm run check` is green, dependencies are pinned and match the SDK, native dirs are generated (CNG plus one config plugin), there are no SCOPE-10/POST leaks, no hard-coded UI strings, components use semantic tokens only, and nothing sensitive is logged. Three things stand in the way of acceptance:

1. The iOS half of the exit demo was not run.
2. Swipe-down dismiss on the shared `BottomSheet` doesn't work at normal swipe speeds, and no test covers it.
3. The OS per-app language (SCOPE-12) isn't wired up on either platform.

## Checks run

| Command | Result |
|---|---|
| `npm run lint` (`expo lint --max-warnings 0`) | exit 0, no warnings |
| `npm run typecheck` (`tsc --noEmit`) | exit 0 |
| `npm test -- --verbose` | **15/15 suites, 80/80 tests passed**, 0 snapshots, ~3.5 s. Includes 1 `it.failing` (M0-Q1 light `textTertiary` contrast), which counts as passing. |
| `npm run check` | exit 0 (same counts) |
| `CI=1 npx expo install --check` | "Dependencies are up to date" |
| `tsc` with a temp config that excludes the gitignored `expo-env.d.ts` and `.expo/types` (fresh-clone simulation, run from `/tmp`) | exit 0 |
| `grep` over `src/` | `process.env` only in `src/shared/config/env.ts`; `console.*` only in the logger sink; no hex/rgb colors outside `src/shared/theme/`; no `palette` use in components; no literal JSX strings or labels outside the test helper; no `textTertiary` use in components |
| en / pt-PT key count | 9 / 9, parity test green |
| `git log` identity | author and committer `ricardo_reis@live.com` on all commits; no `Co-Authored-By` |

## Exit demo

**Android (emulator-5554, dev build, Metro on `localhost:8081` via `adb reverse`).** Verified with `uiautomator dump`, `input tap`/`swipe`/`keyevent` and `screencap`. Screenshots are in `/tmp/m0review/`, outside the repo.

- **Launch:** the app launches to Diary. Log shows `[info] app initialized { appVersion: '0.1.0', pluralRules: true }`, so the Hermes polyfill is active. The tab bar has exactly `Diary`, `Add`, `Profile`, and Diary is selected.
- **`+` from Diary and from Profile:** opens the empty Add Action Sheet (`Add actions`). Route and tab selection don't change.
- **Closing the sheet:**
  - system back closes it
  - a backdrop tap closes it
  - swiping down from the handle does **not** close it at 400, 150 or 60 ms swipe durations; only a 30 ms flick does (see finding 2)
- **Tabs:** Profile tab switches and is selected. Tapping the selected tab again keeps it. Android back on Profile returns to Diary.
- **Dark mode:** switching live re-themes correctly (app bar is surface with a green accent line; bright green `+` with dark icon). The screen is briefly blank while it switches.
- **Relaunch:** relaunch after force-stop from Profile opens Diary (tried 3 times). On my very first launch the app showed Profile selected; I could not reproduce it (possibly a concurrent session on the emulator), so it is not a finding.
- **Device settings:** all reset. `font_scale` is 1.0, night mode is off, and `wm size`/density are physical (never changed). The app was left on Diary.

**iOS (iPhone 17e simulator, iOS 27).** `xcrun simctl io booted screenshot` shows the dev build running with the app bar `Diary` and the `Diary + Profile` bar, Diary selected. I did not test taps, per my instructions. **The `+` sheet and Profile have not been verified on iOS by anyone** (see finding 1).

## ROAD-02 checklist (M0)

| Item | Status | Evidence |
|---|---|---|
| Every behavior in Main specs implemented | **Partially met** | ARCH-01/02/05/14/15, DS-12 and the NAV-01/02 shell are in place. Gaps: swipe-dismiss path (ARCH-06, finding 2); per-app language (ARCH-22 / SCOPE-12, finding 3). |
| `npm run check` green | **Met** | 15 suites / 80 tests, lint and tsc clean |
| Tests at the right ARCH-18 layer; names cite spec IDs | **Partially met** | Component tests (RNTL) and Expo Router in-memory navigation tests exist. Every suite's `describe` cites an ID; a few `it` titles don't (acceptable, since the full test name includes the describe). Missing: swipe-dismiss test (finding 2). The plural test doesn't exercise the polyfill (finding 8). |
| Every string in `en` + `pt-PT` (parity test) | **Met** | `locales.test.ts` checks key parity, non-empty strings and placeholders; 9/9 keys; all UI text goes through `t()`. Two a11y labels concatenate (finding 7). |
| Milestone E2E flows | **Met (none for M0)** | ROAD-02 E2E table starts at M2 |
| Exit demo on both platforms; screenshots (light/dark × default/largest, small phone) | **Partially met** | Android is complete (12 screenshots at 360 dp). iOS has only the Diary launch (4 screenshots); the `+` sheet and Profile were neither run nor captured (`docs/qa/M0/README.md:13-14`). |
| Independent review clean | **Not met** | This review: 3 majors |
| No placeholder UI for in-scope behavior | **Met** | The empty sheet and the app-bar-only Diary/Profile are what the M0 exit demo specifies, and they are logged as known gaps |
| Nothing sensitive in logs (ARCH-15) | **Met** | The only log call is `app initialized { appVersion, pluralRules }` (confirmed in logcat). Redaction is sturdy enough for M0; there are denylist gaps to fix before M3+ (finding 5). |
| M0 extra: dev builds run on both platforms | **Met** | Both launch (verified above) |
| M0 extra: `.env.example` committed | **Met** | `.env.example` is tracked; `.env` is gitignored (`.gitignore:44`); no secrets |
| M0 extra: `npm run check` exists and passes | **Met** | `package.json` `check` script runs lint, typecheck and test |

### Logged gaps and M0-Q1

- **iOS exit-demo gap** (`docs/progress.md:62`): **not acceptable as logged.** ROAD-02 is an "all must hold" gate and says the exit demo runs on both platforms. Navigation tests don't cover native Modal, Reanimated or gesture behavior on iOS. It has to be run (finding 1), or the user has to waive it explicitly and the waiver has to be recorded.
- **Open question M0-Q1** (`docs/progress.md:73`): **acceptable as logged.** This is a real conflict between `tokens.ts` (source of truth for values) and DS-11. It was escalated correctly rather than "fixed", no component uses `textTertiary` for text, and the `it.failing` guard will flip when it's resolved. Finding 6 adds related pairs that should go into the same question.
- **Other known gaps:** acceptable as logged, because each is deferred by the roadmap:
  - the config error throws until the M1 recovery screen
  - typed route builders arrive per route
  - the sheet is empty until M3/M4/M8
  - the 2× tab-label cap
  - pt-BR falls back to the pt-PT translation

## Findings

### Majors

**1. major. ROAD-02 exit demo, DS-13 subset. `docs/progress.md:62`, `docs/qa/M0/README.md:13-14`**

- **Problem:** On iOS, "`+` opens an empty sheet" and the Profile tab were never exercised on the simulator, and no `ios-add-sheet-*` or `ios-profile-*` screenshots exist. The exit demo is half-run on one of the two required platforms.
- **Fix:** Get a tap driver working. Either:
  - install Maestro (ARCH-01/18 needs it from M2 anyway) and add a throwaway or kept flow `launch → tap "Add" → assert sheet → back → tap "Profile"`, or
  - have the user run `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`.

  Then capture the 8 missing iOS screenshots, extend `scripts/qa/m0-ios.sh`, and remove the gap. If the user prefers to waive it, record the waiver in `docs/progress.md`.

**2. major. ARCH-06 ("swipe-dismiss … run the same cancel path"), NAV-03 ("Dismiss: swipe down"), DS-02 (touch targets). `src/shared/components/BottomSheet.tsx:23-24, 56-66, 115-126`**

- **Problem:** The pan gesture is attached only to the handle strip, which is about 20 pt tall (4 pt handle + 2×8 padding). The dismiss threshold is a fixed 80 pt or 800 pt/s. On a content-sized sheet near the bottom edge, 80 pt of travel is physically impossible: on Android the handle sits about 42 dp from the screen edge, inside the gesture-nav zone. Measured on the emulator, swipes of 400, 150 and 60 ms from the handle to the bottom did not dismiss; only a 30 ms flick did. The swipe path has no test. Future sheets will have 48 pt rows (DS-09), and swiping on them will never dismiss.
- **Fix:**
  - Put the `GestureDetector` around the whole sheet (handle + content), and give it `simultaneousWithExternalGesture`/`Gesture.Native()` coordination when content scrolls.
  - Make the distance threshold relative to the measured sheet height, e.g. `min(80, 0.3 × height)` via `onLayout`, and lower the velocity threshold (~500).
  - Make the handle hit area at least `theme.touchMin` tall.
  - Add a test using `react-native-gesture-handler/jest-utils` `fireGestureHandler` for dismissing and non-dismissing drags.

**3. major. SCOPE-12 ("follows the device/OS per-app language"), ARCH-22. `app.json:27`, `src/shared/i18n/i18n.ts:26-41`, `src/shared/i18n/locale.ts:38`**

- **Problem:** The `expo-localization` plugin is registered without `supportedLocales`. As a result:
  - the generated iOS `Info.plist` has no `CFBundleLocalizations`, so iOS Settings shows no per-app Language option;
  - the Android manifest has no `localeConfig`, so Android 13+ per-app language can't select pt-PT.

  Also, Android's `configChanges` includes `locale`, so the activity isn't recreated, and `initI18n()` runs once at startup with no listener. A language change while the app is running is never picked up. `locale.ts:38` says "the OS per-app language comes first", but nothing in the native config makes that possible.
- **Fix:**
  - Change the plugin entry to `["expo-localization", { "supportedLocales": { "ios": ["en", "pt-PT"], "android": ["en", "pt-PT"] } }]` and regenerate the native dirs.
  - Re-resolve the locale on change (expo-localization `useLocales()` in `AppProviders`, or `AppState` → `active`) and call `initI18n(resolveAppLocale(getLocales()))`.
  - Verify the per-app language setting on both platforms and add a unit test that a locale change switches the i18next language.

### Minors

**4. minor. DS-12 ("Primitives own … focus"), DS-10 ("Focus: 2px `focus` outline"). `src/shared/components/PrimaryButton.tsx:32-55`, `TextAction.tsx:32-50`, `PressableIcon.tsx:30-43`, `ListRow.tsx:67-78`, `src/shared/navigation/AppTabBar.tsx:41-54`**

- **Problem:** Only `FormField` shows a focus state. The pressable primitives and the tab items have no focus indicator for hardware keyboard or switch access.
- **Fix:** Add a small shared `useFocusRing()` (`onFocus`/`onBlur` → 2 px `colors.focus` border or outline without layout shift) and use it in every pressable primitive, or log it as a known gap assigned to the M9 accessibility pass.

**5. minor. ARCH-15. `src/shared/logging/logger.ts:29-33, 66-75`**

- **Problem:** Redaction is a key denylist. Common keys pass through unredacted: `q`, `value`, `amount`, `quantity`, `serving`, `servingSize`, `kg`, `lbs`, `text`, `title`/`mealTitle`, `label`, `description`, `data`, `response`, `headers`, `comment`. The free-text `message` is never filtered. It also over-matches, e.g. `fatal` matches `fat`. There are no leaking call sites today, but M3–M6 will add diary, weight and search logging.
- **Fix:** In release builds, keep only allowlisted context keys (e.g. `version`, `durationMs`, `outcome`, `status`, `count`, `provider`, `code`) and drop the rest. Keep the denylist for dev. Document that `message` must be a static literal, e.g. a lint rule banning template literals in `logger.*` first arguments. Add tests for the new keys.

**6. minor. DS-11. `src/shared/theme/__tests__/contrast.test.ts:19-28`**

- **Problem:** The contrast test skips pairs the primitives actually render. Two of those pairs fail 4.5:1 in light mode:
  - `primary` on `primaryTint` is 4.30 (pressed tab label and pressed `TextAction`)
  - `primary` on `canvas` is 4.41 (any `TextAction`/`primary` text on the canvas)

  The input boundary `borderStrong` on `surfaceSubtle` is 1.59 (DS-11 asks ≥3:1 for essential boundaries), and the sheet handle `borderStrong` on `surface` is 1.77.
- **Fix:** Add these pairs to the test, plus `danger`/`dangerTint`, `textSecondary`/`surfaceSubtle` and `warning`/`warningTint`, which currently pass. Add the failing ones to M0-Q1 for the user to decide on token values (tokens are the source of truth) and mark them `it.failing` like the existing case.

**7. minor. ARCH-22 ("No concatenation: use interpolation"). `src/shared/components/FormField.tsx:27`, `src/shared/components/ListRow.tsx:57`**

- **Problem:** Accessible labels are built as `` `${label}, ${unit}` `` and `` `${label}, ${value}` ``, so the separator and word order can't be localized.
- **Fix:** Add a key such as `a11y.labelWithValue: "{{label}}, {{value}}"` in both locale files and build the label with `t()`.

**8. minor. ARCH-22 (plural polyfill), ARCH-18. `src/shared/i18n/__tests__/plurals.test.ts:1-9`**

- **Problem:** Jest runs on Node, which has a native `Intl.PluralRules`, so `@formatjs/intl-pluralrules/polyfill.js` is a no-op there. The test checks Node's ICU, not the polyfill and locale data that Hermes uses. No test covers an i18next plural key.
- **Fix:** In this test, import `@formatjs/intl-pluralrules/polyfill-force.js` plus the same locale-data files (or test the package's exported `PluralRules` directly). Add an i18next `_one`/`_other` resolution test for `pt-PT` once the first plural key lands.

**9. minor. ARCH-05. `src/shared/config/env.ts`, `plugins/withIosSceneLifecycle.js`, `scripts/qa/`**

- **Problem:** `src/shared/config/` is not one of ARCH-05's `shared/{…}` folders, and the top-level `plugins/` and `scripts/` directories aren't in the tree either. The placement is reasonable, but the spec and the repo now disagree.
- **Fix:** Propose to the user an ARCH-05 append (`shared/config` for ARCH-14; `plugins/` for config plugins; `scripts/` for local tooling), and log it.

**10. minor. DS-11 (screen readers). `src/shared/components/BottomSheet.tsx:98-103`**

- **Problem:** `accessibilityLabel` sits on a container that isn't `accessible`, so VoiceOver doesn't announce the sheet name (`Add actions`) when it opens. With `accessibilityViewIsModal`, the backdrop `Close` button is also hidden from VoiceOver, which leaves only the two-finger scrub to dismiss.
- **Fix:** When `visible` turns true, call `AccessibilityInfo.announceForAccessibility(accessibilityLabel)` or move focus to the first row or an accessible handle (`accessibilityRole="button"`, label `closeLabel`, `onPress={onClose}`). Test it.

**11. minor. DS-10 (disabled / loading states). `src/shared/components/PrimaryButton.tsx:57`, `src/shared/components/ListRow.tsx:36-44`**

- **Problem:**
  - With `disabled` and `loading` both set, the spinner uses `onPrimary` (white) on `surfaceSubtle`, which makes it invisible.
  - `ListRow` with `disabled` has no visual change ("less emphasis").
- **Fix:**
  - Use `textSecondary` for the spinner when disabled.
  - Render the `ListRow` label, value and icon in `textSecondary` when disabled.
  - Add a test for each.

**12. minor. ROAD-04 tooling robustness. `scripts/qa/m0-android.sh:3, 24-39`, `plugins/withIosSceneLifecycle.js:48`**

- **Problem:**
  - The Android QA script changes `wm size`/`density`/`font_scale`/`uimode` and resets them only at the end. With `set -u` and no `trap`, an interrupted run leaves the emulator altered.
  - `adoptSceneDelegate` is exported for testing, but no test exercises it.
- **Fix:**
  - Add `trap '…resets…' EXIT` to the script.
  - Add a small Jest test that feeds the SDK 57 `AppDelegate.swift` template through `adoptSceneDelegate`: it should be idempotent and throw on an unknown template.

## Spec traceability

| Spec | Code | Tests | Status |
|---|---|---|---|
| ARCH-01 Stack | `package.json` (exact pins, lockfile); Expo SDK 57 with dev client (`app.json`, `start --dev-client`); Expo Router; i18next + expo-localization; RNGH + Reanimated/Worklets; Zod; Jest + jest-expo + RNTL; `plugins/withIosSceneLifecycle.js` (CNG kept, native dirs gitignored); ARCH-20 notes in `docs/progress.md` | `expo install --check` clean; dev builds launch on both platforms | Met |
| ARCH-02 Code quality | `tsconfig.json` (`strict`, `noUncheckedIndexedAccess`, …); `eslint.config.js` (expo flat + prettier, `no-explicit-any`, `no-console`); `typecheck` script; typed i18n keys (`i18next.d.ts`); `typedRoutes` | lint and tsc green | Met |
| ARCH-05 Structure | `src/app` holds route files only; `src/features/{diary,profile}/screens`; `src/shared/{components,hooks,i18n,logging,navigation,testing,theme}`; `src/bootstrap/{providers.tsx,initialize-app.ts}`; `@/*` alias | n/a | Met, with one extra folder (finding 9) |
| ARCH-06 Navigation | Custom `AppTabBar` (`+` is an action, never selected; pressing the focused tab emits `tabPress` and pops to root); one internal `BottomSheet`; backdrop, back and a11y escape share `onClose`. Typed route builders deferred (logged). | `tabs.test.tsx`: exact items, selection, per-tab stacks, pop-to-root, sheet from both tabs, backdrop/back close. `overlays.test.tsx`: backdrop, `requestClose`, a11y escape, unmount after animation. | Partially met: swipe path broken and untested (finding 2) |
| ARCH-14 Config | `src/shared/config/env.ts` (Zod, https URLs, email; only reader of `process.env`; `ConfigError` names keys, never values; cached); `.env.example` committed; `.env` gitignored; no USDA key | `env.test.ts` (valid, invalid/missing keys without values, `.env.example` loaded) | Met (config-error screen deferred to M1, logged) |
| ARCH-15 Logging | `src/shared/logging/logger.ts` (interface, key/value redaction in all builds, release drops `debug` and error details) | `logger.test.ts` (6 tests) | Met; denylist gaps (finding 5) |
| ARCH-17 (M0 subset) | `initializeApp()`: polyfills → config → i18n → logger; `AppProviders` | Covered indirectly by the navigation tests rendering `RootLayout` | Met for M0 (rest is M1, logged) |
| ARCH-22 Localization | `i18n.ts` (single instance, en fallback, sync init), `locale.ts` (device list → language + formatting locale), `locales/{en,pt-PT}.json`, `polyfills.ts` (`Intl.PluralRules`) | `locales.test.ts` (parity, non-empty, placeholders), `i18n.test.ts` (en/pt-PT, fallback), `locale.test.ts` (6 cases incl. `1,5`), `plurals.test.ts`, `tabs.pt-PT.test.tsx` (pt-PT smoke) | Partially met: per-app language (finding 3), concatenation (finding 7), polyfill test (finding 8) |
| DS-12 Theme + primitives | `theme.ts` (built from `tokens.ts`; `onPrimary`/`onAppBar` derived; one elevation style; platform `touchMin`); `ThemeProvider`/`useTheme`; all 12 primitives in `src/shared/components/` plus `AppBar`. Semantic tokens only (grep clean). | `theme.test.tsx` (OS light/dark, forced scheme, token parity); `contrast.test.ts`; `actions`/`overlays`/`status-and-forms`/`text-and-icons` tests (all 12 primitives) | Mostly met: focus ownership (finding 4); contrast coverage (finding 6) |
| DS-07 Chrome (as used) | `AppBar.tsx` (52 + inset, green in light, surface + green line in dark); `AppTabBar.tsx` (56 + inset, 48 `+` circle, rises 8, 28 icon, level-1 elevation; selected shown by color + weight + filled icon) | `tabs.test.tsx` (items, selection) | Met |
| NAV-01 | `src/app/index.tsx` redirects to `/diary` | `NAV-01: launches to the Diary` | Met |
| NAV-02 | `(tabs)/{diary,profile}/_layout.tsx` stacks; exactly 3 bar items; native-stack pop-to-top on `tabPress`. Scroll-to-top at root: n/a until M2. | 4 NAV-02 tests; Android back from Profile goes to Diary (device) | Met for M0 |
| NAV-03 (M0 part) | `AddActionSheet.tsx` (empty by design), opened from both tabs; dismiss via back and backdrop | `NAV-03` tests (both tabs, backdrop, back) | Partially met: swipe-down dismiss (finding 2) |
