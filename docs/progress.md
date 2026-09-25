# Progress log (ROAD-03)

Single place for implementation status. Updated in the same commit as the work it describes.

| Milestone | Status |
|---|---|
| M0 Skeleton | awaiting user acceptance |
| M1 Data + domain | not started |
| M2 Diary (read) | not started |
| M3 Quick Calories | not started |
| M4 Custom foods + ruler | not started |
| M5 Search + Open Food Facts | not started |
| M6 USDA | not started |
| M7 Meal Detail + copy | not started |
| M8 Profile | not started |
| M9 Hardening | not started |

## M0 Skeleton

Status: **awaiting user acceptance** · Start commit: `553efac` (review range `553efac..HEAD`)

### Tasks
- [x] T1 Expo app scaffold: SDK 57, dev client, Expo Router (`src/app`), strict TS, ESLint + Prettier, Jest (`jest-expo`) + RNTL, `npm run lint|typecheck|test|check`
- [x] T2 Typed env config (Zod, `src/shared/config/env.ts`) + `.env.example`; logger with redaction (`src/shared/logging`) (ARCH-14/15)
- [x] T3 i18n scaffold (`src/shared/i18n`): `en` + `pt-PT`, device locale → language + formatting locale, typed keys, key-parity test (ARCH-22)
- [x] T4 Theme from `tokens.ts` (`src/shared/theme`): light/dark `ThemeProvider` + `useTheme`, platform touch minimum, one elevation style, token contrast test (DS-12, DS-05, DS-11)
- [x] T5 DS-12 primitives (`src/shared/components`): `AppText, AppIcon, PressableIcon, PrimaryButton, TextAction, FormField, ListRow, SectionHeader, ProgressTrack, BottomSheet, ConfirmationDialog, InlineStatus` + component tests; `renderWithProviders` test helper
- [x] T6 Tabs: `(tabs)/{diary,profile}` stacks, custom `AppTabBar` (`Diary + Profile`) with `+` opening the empty Add Action Sheet, `AppBar` (DS-07), app providers + `initializeApp` (ARCH-17 M0 subset), navigation tests incl. pt-PT smoke
- [x] T7 Dev builds on iOS simulator (iPhone 17e, iOS 27) + Android emulator (Pixel_10); exit demo run on both platforms (iOS completed in R1-1)
- [x] T8 QA screenshots under `docs/qa/M0/` (index in its README; capture scripts in `scripts/qa/`)
- [x] T9 Independent review (`docs/qa/M0/review.md`), fix blockers/majors
  - Round 1 (`4695aae`, now `docs/qa/M0/review-round1.md`): not clean, 0 blockers · 3 majors · 9 minors. Fix list, in order:
  - [x] R1-2 major: BottomSheet swipe-down dismiss. The whole sheet is the drag surface, distance scales with sheet height, the handle is the a11y Close button, and the sheet name is announced on open (also R1-10). Gesture tests added; slow swipe verified on Android.
  - [x] R1-3 major: per-app language (SCOPE-12). `expo-localization` `supportedLocales` (en, pt-PT) → iOS `CFBundleLocalizations`, Android `localeConfig`; `useSyncAppLocale` re-resolves on change. Both dev builds rebuilt; verified on Android (live switch, no restart) and iOS (Settings › Apps › Calorie Tracker › Language; opens in pt-PT). Screenshots in `docs/qa/M0/`.
  - [x] R1-1 major: iOS exit demo run with the simulator tool (`+` opens the sheet; swipe-down and backdrop close it; Profile tab selects) and the 8 missing iOS screenshots captured. Found and fixed: live Dynamic Type changes left text clipped (`AppText` remounts on font scale).
  - [x] R1-6 minor: contrast test covers the pairs primitives render; the failing ones are `it.failing` and listed in M0-Q1.
  - [x] R1-7 minor: FormField/ListRow join label + value/unit via `a11y.labelWithValue` (en + pt-PT); test.
  - [x] R1-8 minor: plural test removes Node's `Intl.PluralRules` and loads the app's polyfill module + locale data. An i18next `_one`/`_other` test comes with the first plural key.
  - [x] R1-11 minor: disabled + loading PrimaryButton spinner uses `textSecondary`; disabled ListRow label uses `textSecondary`; tests.
  - [x] R1-12 minor: `scripts/qa/m0-android.sh` resets the emulator in an EXIT `trap`; `adoptSceneDelegate` test (rewrite, idempotent, throws on unknown template).
  - [x] R1-5 minor: release builds keep only allowlisted context keys (`RELEASE_CONTEXT_KEYS`); denylist widened (`q`, amount, serving, kg, title, response…; `fatal` no longer matches `fat`); credential-looking messages redacted; tests.
  - [x] R1-4 minor: `FocusablePressable` draws the DS-10 2px `focus` outline (no layout shift) on every pressable primitive, tab item, dialog action and sheet handle; component tests. Hardware-keyboard check on device is part of the M9 DS-13 pass.
  - [x] R1-9 minor: ARCH-05 append approved (M0-Q3) and applied.
  - [x] Round 2 (`b5f9245`, `docs/qa/M0/review.md`): **clean**, 0 blockers · 0 majors · 6 minors. Minors left as follow-ups (not blocking):
    - R2-1: more light-mode pairs → M0-Q1 (InlineStatus action text; focus ring on the app bar).
    - R2-2: sheet handle target 44 dp on Android; derive `hitSlop` from `touchMin`.
    - R2-3: pt-PT smoke test should also render Profile and the Add sheet.
    - R2-4: `tabs.test.tsx` "backdrop closes it" presses the handle; press the backdrop testID.
    - R2-5: literal `gap`/`hitSlop`/`maxWidth`/`letterSpacing` values → tokens.
    - R2-6: `m0-ios.sh` EXIT trap + header; `routes.ts` comment. (Progress-log part fixed here.)

### ROAD-02 checklist
- [x] Every behavior in Main specs implemented (ARCH-01/02/05/06/14/15/22, DS-12)
- [x] `npm run check` green
- [x] Tests at the right ARCH-18 layer; names cite spec IDs
- [x] Every string in `en` + `pt-PT` (parity test)
- [x] E2E flows: none for M0
- [x] Exit demo on both platforms; screenshots (light + dark, default + largest text, small phone) in `docs/qa/M0/`
- [x] Independent review clean (round 2)
- [x] No placeholder UI for in-scope behavior
- [x] Nothing sensitive in logs
- [x] M0 extras: dev builds on both platforms · `.env.example` committed · `npm run check` exists and passes

### Dependency notes (ARCH-20)
All versions pinned exactly; installed via `npx expo install` where native.
| Package | Need |
|---|---|
| `expo-router`, `react-native-screens`, `react-native-safe-area-context`, `expo-linking`, `expo-constants`, `expo-status-bar` | ARCH-01 navigation (Router install set) |
| `expo-dev-client` | ARCH-01 development builds |
| `expo-system-ui` | Root background follows light/dark on Android (`userInterfaceStyle: automatic`) |
| `expo-localization`, `i18next`, `react-i18next` | ARCH-01/22 localization |
| `react-native-reanimated`, `react-native-worklets`, `react-native-gesture-handler` | ARCH-01 gestures/motion; worklets is Reanimated 4's required peer |
| `@expo/vector-icons` + `expo-font`, `expo-asset` (peers) | DS-06 one rounded icon family from the Expo stack |
| `zod` | ARCH-01/03 validation |
| `@formatjs/intl-pluralrules` | ARCH-22 polyfill: Hermes on SDK 57 lacks `Intl.PluralRules` on both platforms (checked on device). Loads en + pt/pt-PT data only |
| dev: `jest`, `jest-expo`, `@testing-library/react-native`, `test-renderer`, `@types/jest` | ARCH-01/18 tests (`test-renderer` is RNTL 14's peer) |
| dev: `eslint`, `eslint-config-expo`, `prettier`, `eslint-config-prettier`, `eslint-plugin-prettier` | ARCH-02 lint/format |
| dev: `react-dom` | Pinned to `react`'s version only to satisfy optional peers during install; never imported (web is not a deliverable) |

### Known gaps
- Tab labels scale up to 2× (Android's max font scale) so a third-width tab never clips at iOS AX sizes (DS-11 no-clip; iOS tab bars don't scale labels natively).
- Local dev: CocoaPods refuses a world-readable `~/.netrc`; builds here used `NETRC=<empty 0600 dir>`. Metro is reached via `localhost` (`adb reverse` on Android).
- Add Action Sheet is empty by design in M0 (exit demo); its rows arrive with their flows (NAV-03: M3 Quick Calories, M4/M5 Add Food, M8 Update Weight).
- Diary and Profile are app-bar shells until M2 / M8.
- Startup covers config → logger → i18n only; SQLite, seed, launch-screen hold and the recovery screen are M1 (ARCH-17, ARCH-13). A config error currently throws at startup.
- Typed route builders (ARCH-06) are added per route as screens land; M0 has only the tab roots.
- Any Portuguese device language (e.g. `pt-BR`) uses the pt-PT translation, since it is the only Portuguese one; number/date formatting still follows the device locale (SCOPE-12).
- E2E tooling: Maestro 2.10.0 CLI (`~/.maestro/bin`, not an npm dependency) runs `.maestro/` flows via `scripts/e2e.sh android|ios` against the dev build + localhost Metro. `.maestro/m0-shell.yaml` covers the M0 exit demo and passes on both platforms (Android 29 s, iOS 14 s). ROAD-02 flows start at M2.
- Icons use Ionicons (outline; filled only for selected states), DS-06.

### Open questions
- ~~**M0-Q2**~~ Resolved 2026-09-25: the user ran `xcode-select`, so the simulator tool works.
- ~~**M0-Q3**~~ Resolved 2026-09-25: yes. ARCH-05 now lists `.maestro/`, `plugins/`, `scripts/` and `shared/config`. Closes review R1-9.
- **M0-Q1** Token contrast (DS-11). Partly resolved 2026-09-25: light `textTertiary` is now `#687169` (5.05 surface · 4.74 canvas · 4.52 surfaceSubtle).
  - Proposal awaiting approval (smallest change that passes; each failing pair is an `it.failing` test until then):
    | Token | Now | Proposed | Result |
    |---|---|---|---|
    | light `primary` | `#238447` | `#207941` | ≥4.62 on primaryTint, canvas, surfaceSubtle, warningTint, dangerTint; white on it 5.42 |
    | light `primaryPressed` | `#1D713D` | `#185C34` (green800) | stays visibly darker than the new primary |
    | light `warning` | `#A56300` | `#A06000` | 4.55 on warningTint · 5.04 on surface |
    | light `borderStrong` | `#BBC5BE` | `#878E89` | 3.00 on surfaceSubtle · 3.35 on surface (inputs and sheet handle look noticeably darker) |
    | dark `borderStrong` | `#59645C` | `#68726B` | 3.06 on surfaceSubtle · 3.46 on surface |
    | focus ring inside the app bar | `focus` 1.15 on light appBar | `onAppBar` (white), 6.03 | code change in `FocusablePressable`/`AppBar`, no new token |
