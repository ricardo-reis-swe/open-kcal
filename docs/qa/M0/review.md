# M0 Skeleton — Independent review, round 2 (ROAD-03)

- **Date:** 2026-09-25
- **Reviewer:** independent reviewer agent, round 2 (fresh context, read-only)
- **Commit range:** `553efac..b5f9245` (HEAD `b5f9245`, 25 commits)
- **Scope:** ROAD-01 M0 row; the ROAD-02 checklist and M0 extras; ARCH-01/02/05/06/14/15/22; DS-12, plus DS-10/DS-11 as the primitives use them; NAV-01/02/03 tab shell; SCOPE-12. I also checked the 11 round-1 fixes (R1-1 … R1-12, except R1-9, which is waiting on M0-Q3).

## Summary

**Verdict: clean.** 0 blockers · 0 majors · 6 minors.

The three round-1 majors are fixed, and I confirmed each one on devices myself:

- **Swipe-down dismiss (R1-2):** normal-speed swipes close the sheet on Android and iOS.
- **Per-app language (R1-3):** switching the Android per-app language to pt-PT changes the running app live. The process ID stays the same and the app stays on the Profile route.
- **iOS exit demo (R1-1):** I ran it on the iPhone 17e simulator.

`npm run check` passes: 18 suites, 108 tests. Test names cite spec IDs. There are no SCOPE-10 or POST leaks, no hard-coded colors or UI strings, and no sensitive logging.

What's left is minor: some contrast pairs are neither tested nor logged, the sheet handle's touch target is 4 dp short on Android, the pt-PT smoke test covers only one screen, one test is misnamed, a few spacing values are literals, and some progress-log and tooling text is out of date. Open questions M0-Q1 and M0-Q3 are logged acceptably. Finding 1 below adds more pairs to M0-Q1.

## Checks run

| Command | Result |
|---|---|
| `npm run lint` (`expo lint --max-warnings 0`) | **exit 0**, no warnings |
| `npm run typecheck` (`tsc --noEmit`) | **exit 0** |
| `npm test` | **exit 0**: 18/18 suites, 108/108 tests, 0 snapshots. This includes 8 `it.failing` M0-Q1 contrast cases, which count as passing. |
| `npm run check` | **exit 0** (same counts) |
| `npx jest --verbose` | exit 0; every `describe` cites a spec ID |
| `CI=1 npx expo install --check` | "Dependencies are up to date" |
| Generated native config | Android manifest has `android:localeConfig="@xml/locales_config"`. iOS `Info.plist` has `CFBundleLocalizations = ["en","pt-PT"]`. |
| `grep` over `src/` and `plugins/` | Hex/rgba colors appear only in `src/shared/theme/`. `process.env` is read only in `src/shared/config/env.ts`. `console.*` is used only in the logger sink. No `palette` or `textTertiary` use in components. The only literal JSX text is test-only (`src/shared/testing/appRoutes.tsx:28`). |
| SCOPE-10 / POST keyword sweep (barcode, health, sync, analytics, sentry, streak, recipe, account…) | no hits in app code or config |
| en / pt-PT keys | 11 / 11; parity, non-empty and placeholder tests pass |
| `git log` identity | author and committer are `ricardo_reis@live.com` on all 25 commits; no `Co-Authored-By`; no other email in tracked files |
| Contrast spot check (a script using the same WCAG formula) | see finding 1 |

## Exit demo

**Android** (`emulator-5554`, Pixel_10 dev build, Metro on `localhost:8081`), driven with `scripts/android-drive.sh`:

- **Launch:** the app opens on Diary. The app bar reads `Diary`. The bar has `Diary` (`selected=true`), `Add` and `Profile` (`selected=false`). Logcat shows only `[info] app initialized { appVersion: '0.1.0', pluralRules: true }`.
- **`+` from Diary:** opens the empty `Add actions` sheet. Its `Close` handle is exposed to accessibility. The route doesn't change.
- **Closing the sheet:**
  - System back closes it.
  - A backdrop tap closes it.
  - Swipes from the handle close it at every speed I tried: 300 ms and 500 ms (about 33 dp of travel), and 350 ms from Profile.
  - A 400 ms swipe starting on the sheet body (28 dp) closes it.
  - Short drags (about 7–17 dp) spring back. A drag of 8 dp or less on the handle counts as a tap on the `Close` button, which is expected.
- **Profile:** the Profile tab selects (`selected=true`, and Diary goes to false), and the app bar reads `Profile`. `+` from Profile opens the sheet; back closes it and the app stays on Profile.
- **Per-app language (SCOPE-12):**
  - `cmd locale set-app-locales … --locales pt-PT` switched the running app to `Diário · Adicionar · Perfil` with no restart (same PID, 12975), still on the Profile route. The sheet read `Ações de adicionar` / `Fechar`.
  - Resetting with `--locales ""` brought English back.
- **Observation, not a finding:** on this roughly 52 dp empty sheet, the drag distance that dismisses in practice was about 20–28 dp. The computed threshold is 0.3 × height ≈ 15.6 dp. It works at normal speed, but re-check it with a taller sheet when M3 adds rows.
- **Observation, not a finding:** logcat has one `Element type is invalid … AppTabBar` error at 16:36:42, from process 5644. That is a mid-edit hot reload about a minute before HEAD was committed. Clean launches after it (16:37, 16:41) had no errors.

**iOS** (iPhone 17e simulator, dev build opened with `xcrun simctl openurl`), driven with the simulator tool:

- The app launches on Diary. The `Diary + Profile` bar shows Diary selected.
- `+` opens the sheet. A 0.4 s, 40 pt swipe down from the handle closes it.
- `+` again, then a backdrop tap, closes it.
- The Profile tab selects (filled icon, green bold label, app bar `Profile`).
- `+` from Profile opens the sheet; a backdrop tap closes it.
- Back to Diary.

**Device state afterwards:** Android `font_scale` 1.0, night mode off, `wm size`/density physical (1080x2424 / 420), app locales `[]`. Both devices were left on Diary. I changed no iOS settings.

## ROAD-02 checklist (M0)

| Item | Status | Evidence |
|---|---|---|
| Every behavior in Main specs implemented | **Met** | See the traceability table. Deferred items are logged: typed route builders arrive per route, and the recovery screen is M1. |
| `npm run check` green | **Met** | exit 0; 18 suites, 108 tests |
| Tests at the right ARCH-18 layer; names cite spec IDs | **Met** | Component tests (RNTL), Expo Router in-memory navigation tests, a gesture test through `fireGestureHandler`, and a plugin unit test. One test name is misleading (finding 4). |
| Every string in `en` + `pt-PT` (parity test) | **Met** | `locales.test.ts`: key parity, non-empty, placeholders. a11y joins use `a11y.labelWithValue`. The pt-PT smoke test covers only Diary (finding 3). |
| Milestone E2E flows | **Met (none for M0)** | The ROAD-02 E2E table starts at M2 |
| Exit demo on both platforms; screenshots (light/dark × default/largest, small phone) | **Met** | I ran it on both platforms (above). `docs/qa/M0/` has all 12 Android and 12 iOS screen shots, plus the per-app language evidence. |
| Independent review clean | **Met** | This review: 0 blockers, 0 majors |
| No placeholder UI for in-scope behavior | **Met** | The empty sheet and the app-bar-only Diary/Profile are what the M0 exit demo specifies, and they are logged as known gaps |
| Nothing sensitive in logs (ARCH-15) | **Met** | One log call site (`initialize-app.ts:19`), confirmed in logcat. Release builds keep only allowlisted keys. |
| M0 extra: dev builds run on both platforms | **Met** | Both verified above |
| M0 extra: `.env.example` committed | **Met** | Tracked; `.env` is gitignored; public values only |
| M0 extra: `npm run check` exists and passes | **Met** | `package.json` `check` = lint + typecheck + test |

**Open questions and gaps:**

- **M0-Q1** (token contrast, `docs/progress.md:87`): **logged acceptably.** It is a real conflict between `tokens.ts` and DS-11. It was escalated rather than "fixed", and every failing pair is an `it.failing` case that will fail loudly once the tokens change. It should also list the pairs in finding 1.
- **M0-Q3** (ARCH-05 append, `docs/progress.md:86`, R1-9): **logged acceptably.** The folders are placed sensibly, and a spec change needs the user's approval.
- **Other known gaps** (2× tab-label cap, config error throws until M1, pt-BR uses the pt-PT translation, empty sheet): acceptable as logged.

## Round-1 fix verification

| Fix | Holds? | Evidence |
|---|---|---|
| R1-2 swipe dismiss | Yes | The whole sheet is the drag surface (`BottomSheet.tsx:78-90,122`). The distance scales with sheet height (`:33-38`). Tests: `bottom-sheet-gesture.test.tsx`. Devices: see Exit demo. |
| R1-3 per-app language | Yes | Plugin `supportedLocales` (`app.json:27-34`); `useSyncAppLocale.ts`; `useSyncAppLocale.test.tsx`. Native config generated. Live Android switch verified. |
| R1-1 iOS demo evidence | Yes | I re-ran the iOS demo. The 8 extra iOS screenshots exist. |
| R1-6 contrast coverage | Mostly | `contrast.test.ts:19-76`. Some pairs are still missing (finding 1). |
| R1-7 a11y label localization | Yes | `FormField.tsx:29`, `ListRow.tsx:61`, key present in both locales, test present |
| R1-8 plural polyfill test | Yes | `plurals.test.ts` deletes the native `Intl.PluralRules`, then loads `@/bootstrap/polyfills`. It asserts `polyfilled` and the pt-PT vs pt rules. |
| R1-10 sheet name announced; handle a11y | Yes | `BottomSheet.tsx:72-74,143-159`, with a test |
| R1-11 disabled states | Yes | `PrimaryButton.tsx:63`, `ListRow.tsx:40`, with tests |
| R1-5 logger allowlist | Yes | `logger.ts:36-49,61-66`. `fat(?!al)`. Messages are redacted. Tests present. |
| R1-4 focus ring | Yes, with a gap | `FocusablePressable.tsx` is used by every pressable primitive, the tab items, dialog actions and the sheet handle, with tests. It is not visible on the light app bar (finding 1). |
| R1-12 QA script trap + plugin test | Android yes; iOS no | `m0-android.sh:27` has the trap. `plugins/__tests__/withIosSceneLifecycle.test.js` has 3 tests. `m0-ios.sh` has no trap (finding 6). |

## Findings

### Blockers
None.

### Majors
None.

### Minors

**1. minor. DS-11 (boundaries/indicators ≥3:1, text ≥4.5:1), DS-10 (focus). `src/shared/theme/__tests__/contrast.test.ts:19-46`, `src/shared/components/InlineStatus.tsx:59`, `src/shared/components/FocusablePressable.tsx:16-18`, `src/shared/components/AppBar.tsx:50`**

- **Problem:** Some pairs the primitives render are neither tested nor listed in M0-Q1. All of them fail in light mode only; dark mode passes.
  - **InlineStatus action text.** The optional recovery action is a `TextAction` in `primary` sitting on the status background:
    - 4.21:1 on `surfaceSubtle` (info, offline, loading)
    - 4.25:1 on `warningTint`
    - 4.01:1 on `dangerTint` (for example "Retry" on an error)
  - **Focus ring on the app bar.** The 2px `focus` outline (`#1769D2`) on the light app bar (`#1D713D`) is 1.15:1. It is invisible around the back button and trailing actions that M2+ will put there.
- **Fix:**
  - Add these pairs to the contrast test as `it.failing` cases and to M0-Q1, so the user can decide the token values.
  - For the app bar, pick a ring color that reaches 3:1 against `appBar`. Either the user sets a token value, or `FocusablePressable` accepts a `focusColor` (for example `onAppBar`) that `PressableIcon` passes when it is inside `AppBar`.

**2. minor. DS-02 (touch targets 48×48 on Android), DS-09 (sheets). `src/shared/components/BottomSheet.tsx:148-149`**

- **Problem:** The handle, which is also the accessible Close button, is 4 + 2×8 = 20 dp tall. With a fixed `hitSlop` of 12 top and bottom, its target is 44 dp, below Android's 48 dp `touchMin`. Uiautomator shows its bounds as 20 dp tall (y 2288–2340 px at 420 dpi).
- **Fix:** Derive the slop from the theme, for example `const slop = Math.max(0, (theme.touchMin - (theme.sizes.sheetHandle.height + 2 * theme.spacing[2])) / 2)`, and assert the resulting target in the gesture test.

**3. minor. ARCH-22 ("one render smoke test per screen in `pt-PT`"). `src/shared/navigation/__tests__/tabs.pt-PT.test.tsx:12-18`**

- **Problem:** The pt-PT smoke test renders only `/diary`. The Profile screen and the Add Action Sheet are never rendered in pt-PT in tests. I checked both in pt-PT on the device.
- **Fix:** In the same test, press `Perfil` and assert the `Perfil` header. Then press `Adicionar` and assert the `Fechar` button. Or add an `it` for each.

**4. minor. ROAD-02 (test names cite what they test), ARCH-06. `src/shared/navigation/__tests__/tabs.test.tsx:79-85`**

- **Problem:** The test named `ARCH-06: backdrop closes it` presses the button named `Close`. That button is now the sheet handle; the backdrop is `accessible={false}` and has no role. So this navigation test covers the handle, not the backdrop. The backdrop path is covered only in isolation (`overlays.test.tsx:31-36`).
- **Fix:** Press `screen.getByTestId('add-action-sheet-backdrop')` in this test, and add or rename a separate `handle (Close) closes it` case.

**5. minor. DS-05 (4pt grid, token spacing), DS-12 (primitives own theme). `src/shared/components/FormField.tsx:103`, `src/shared/components/PrimaryButton.tsx:81`, `src/shared/navigation/AppTabBar.tsx:119`, `src/shared/components/SectionHeader.tsx:26`, `src/shared/components/ConfirmationDialog.tsx:110`, `src/shared/components/BottomSheet.tsx:148`**

- **Problem:** Some layout values are literals instead of tokens:
  - `gap: 8` twice
  - `gap: 2`
  - `letterSpacing: 0.4`
  - `maxWidth: 400`
  - `hitSlop` 12

  The values happen to match the grid, but token changes won't reach them.
- **Fix:**
  - Use `theme.spacing[2]` and `theme.spacing[0.5]` inside the style callbacks.
  - For the dialog width and letter spacing, propose a token to the user, or keep the literal with a one-line rationale.

**6. minor. ROAD-03 (progress log is the single source of status), ROAD-04 (local tooling). `docs/progress.md:29,46-56`, `scripts/qa/m0-ios.sh:2,8-18`, `src/shared/navigation/routes.ts:3`**

- **Problem:**
  - **Progress log:** T7 still says "iOS launch + tab shell, see gaps", but R1-1 closed that gap. Every item in the ROAD-02 checklist is still unticked, including items that are met (check green, `.env.example`, dev builds).
  - **`m0-ios.sh`:**
    - Line 2 still says "No taps available".
    - It captures only the Diary shots; the sheet and Profile shots can't be reproduced from a script.
    - It has no `EXIT` trap. `appearance` and `content_size` are reset only on line 18, the same issue R1-12 fixed on Android.
  - **`routes.ts`:** line 3 says route builders come "once Expo Router is set up"; Expo Router is set up now.
- **Fix:**
  - Tick the ROAD-02 items that are met and correct T7.
  - Add `trap 'xcrun simctl ui booted appearance light; xcrun simctl ui booted content_size large' EXIT` to `m0-ios.sh`, update its header, and note that the sheet and Profile captures are manual (simulator tool) until Maestro arrives.
  - Reword the `routes.ts` comment to "added per route as screens land (ARCH-06)".

## Spec traceability

| Spec | Code | Tests | Status |
|---|---|---|---|
| ARCH-01 Stack | `package.json` (exact pins, lockfile; Expo SDK 57, dev client, Expo Router, i18next + expo-localization, RNGH + Reanimated/Worklets, Zod, jest-expo + RNTL); CNG with native dirs gitignored; one local config plugin, `plugins/withIosSceneLifecycle.js`; ARCH-20 notes in `docs/progress.md` | `expo install --check` clean; `withIosSceneLifecycle.test.js`; dev builds run on both platforms | Met |
| ARCH-02 Code quality | `tsconfig.json` (`strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`); `eslint.config.js` (expo flat + prettier, `no-explicit-any`, `no-console`); `typecheck` script; typed i18n keys (`i18next.d.ts`); `typedRoutes` | lint and tsc exit 0 | Met |
| ARCH-05 Structure | `src/app` holds route files only; `src/features/{diary,profile}/screens`; `src/shared/{components,hooks,i18n,logging,navigation,testing,theme}`; `src/bootstrap/{providers.tsx,initialize-app.ts}`; `@/*` alias. Extra folders `shared/config`, `plugins/`, `scripts/` are pending M0-Q3. | n/a | Met (append pending M0-Q3, logged) |
| ARCH-06 Navigation | Custom `AppTabBar` (`+` is an action and never selected; pressing the focused tab emits `tabPress`, which pops to root); one internal `BottomSheet`; back (`onRequestClose`), backdrop, swipe (`shouldDismissSheet`), handle and a11y escape all call `onClose`. Typed builders deferred per route (logged). | `tabs.test.tsx` (items, selection, per-tab stacks, pop-to-root, sheet from both tabs, back); `overlays.test.tsx` (backdrop, back, escape, unmount); `bottom-sheet-gesture.test.tsx` (flick, slow drag closes, short drag springs back, handle Close) | Met (test naming, finding 4) |
| ARCH-14 Config | `src/shared/config/env.ts` (Zod https URLs + email; only reader of `process.env`; `ConfigError` names keys, never values; cached); `.env.example` committed; `.env` gitignored; no USDA key | `env.test.ts` (3 tests) | Met (config-error screen is M1, logged) |
| ARCH-15 Logging | `src/shared/logging/logger.ts` (interface; key denylist in all builds; release keeps only allowlisted keys, drops `debug`, keeps only the error name; credential-looking values and messages redacted); single call site `initialize-app.ts:19` | `logger.test.ts` (9 tests); logcat confirmed | Met |
| ARCH-17 (M0 subset) | `initializeApp()`: polyfills → config → i18n → log; `AppProviders` (gesture root, safe area, i18n, theme, navigation theme) | Covered by the router tests rendering `RootLayout` | Met for M0 (rest is M1, logged) |
| ARCH-22 Localization | `i18n.ts` (single instance, en fallback, sync init, `escapeValue: false`); `locale.ts`; `useSyncAppLocale.ts` (live OS per-app language); `locales/{en,pt-PT}.json`; `polyfills.ts` (`Intl.PluralRules` + en/pt/pt-PT data); `a11y.labelWithValue` interpolation | `locales.test.ts`, `i18n.test.ts`, `locale.test.ts` (6), `plurals.test.ts` (2), `useSyncAppLocale.test.tsx`, `tabs.pt-PT.test.tsx` | Met (smoke coverage, finding 3) |
| SCOPE-12 | expo-localization `supportedLocales` → iOS `CFBundleLocalizations`, Android `localeConfig`; no in-app switcher; formatting follows the device locale | `locale.test.ts` (pt-PT comma decimal, English-in-Portugal formatting); device: live Android switch | Met |
| DS-12 Theme + primitives | `theme.ts` (built from `tokens.ts`; `onPrimary`/`onAppBar` derived; one elevation style; platform `touchMin`); `ThemeProvider`/`useTheme` (OS or forced scheme); all 12 primitives plus `AppBar` and `FocusablePressable` in `src/shared/components/`; semantic tokens only | `theme.test.tsx` (4); `contrast.test.ts` (14 incl. 8 `failing`); `actions` (16), `overlays` (10), `status-and-forms` (12), `text-and-icons` (7), `bottom-sheet-gesture` (4) | Met (literals, finding 5) |
| DS-10 States (as used) | Pressed tints; filled buttons darken; disabled keeps readable `textSecondary`; loading spinner stays visible on the disabled fill; focus ring on every pressable; reduced motion swaps the sheet slide for a fade (`useReducedMotion`) | `actions.test.tsx` (disabled, loading, focus ×4); `useReducedMotion.test.tsx` | Met (focus ring on the app bar, finding 1) |
| DS-11 Accessibility (as used) | One coherent label per row; icons hidden; `alert` roles for errors; sheet name announced on open; handle is Close; text always scales, and `AppText` remounts when the font scale changes; tab labels capped at 2× | `text-and-icons.test.tsx`, `bottom-sheet-gesture.test.tsx`, `contrast.test.ts` | Met; M0-Q1 pairs pending with the user (plus finding 1) |
| DS-07 Chrome (as used) | `AppBar.tsx` (52 + inset; green in light, surface + green line in dark); `AppTabBar.tsx` (56 + inset; 48 `+` circle rising 8; 28 icon; level-1 elevation; selected = color + weight + filled icon) | `tabs.test.tsx` | Met |
| NAV-01 | `src/app/index.tsx` redirects to `/diary` | `NAV-01: launches to the Diary`; device launch on both platforms | Met |
| NAV-02 | `(tabs)/{diary,profile}/_layout.tsx` stacks; exactly 3 bar items; pop-to-root on `tabPress`. Scroll-to-top at root is n/a until M2. | 4 NAV-02 tests; device: tab selection on both platforms | Met for M0 |
| NAV-03 (M0 part) | `AddActionSheet.tsx` (empty by design; rows arrive in M3/M4/M8), opened from both tabs; dismiss by swipe down, tap outside, back; no barcode | NAV-03 tests (both tabs, back, handle); gesture tests; device: all three dismiss paths on Android, swipe and backdrop on iOS | Met |
