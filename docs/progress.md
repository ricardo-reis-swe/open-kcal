# Progress log (ROAD-03)

Single place for implementation status. Updated in the same commit as the work it describes.

| Milestone | Status |
|---|---|
| M0 Skeleton | in progress |
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

Status: **in progress** · Start commit: `553efac` (review range `553efac..HEAD`)

### Tasks
- [x] T1 Expo app scaffold: SDK 57, dev client, Expo Router (`src/app`), strict TS, ESLint + Prettier, Jest (`jest-expo`) + RNTL, `npm run lint|typecheck|test|check`
- [x] T2 Typed env config (Zod, `src/shared/config/env.ts`) + `.env.example`; logger with redaction (`src/shared/logging`) (ARCH-14/15)
- [x] T3 i18n scaffold (`src/shared/i18n`): `en` + `pt-PT`, device locale → language + formatting locale, typed keys, key-parity test (ARCH-22)
- [x] T4 Theme from `tokens.ts` (`src/shared/theme`): light/dark `ThemeProvider` + `useTheme`, platform touch minimum, one elevation style, token contrast test (DS-12, DS-05, DS-11)
- [x] T5 DS-12 primitives (`src/shared/components`): `AppText, AppIcon, PressableIcon, PrimaryButton, TextAction, FormField, ListRow, SectionHeader, ProgressTrack, BottomSheet, ConfirmationDialog, InlineStatus` + component tests; `renderWithProviders` test helper
- [x] T6 Tabs: `(tabs)/{diary,profile}` stacks, custom `AppTabBar` (`Diary + Profile`) with `+` opening the empty Add Action Sheet, `AppBar` (DS-07), app providers + `initializeApp` (ARCH-17 M0 subset), navigation tests incl. pt-PT smoke
- [ ] T7 Dev builds on iOS simulator + Android emulator; exit demo
- [ ] T8 QA screenshots under `docs/qa/M0/`
- [ ] T9 Independent review (`docs/qa/M0/review.md`), fix blockers/majors

### ROAD-02 checklist
- [ ] Every behavior in Main specs implemented (ARCH-01/02/05/06/14/15/22, DS-12)
- [ ] `npm run check` green
- [ ] Tests at the right ARCH-18 layer; names cite spec IDs
- [ ] Every string in `en` + `pt-PT` (parity test)
- [ ] E2E flows: none for M0
- [ ] Exit demo on both platforms; screenshots (light + dark, default + largest text, small phone) in `docs/qa/M0/`
- [ ] Independent review clean
- [ ] No placeholder UI for in-scope behavior
- [ ] Nothing sensitive in logs
- [ ] M0 extras: dev builds on both platforms · `.env.example` committed · `npm run check` exists and passes

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
- Add Action Sheet is empty by design in M0 (exit demo); its rows arrive with their flows (NAV-03: M3 Quick Calories, M4/M5 Add Food, M8 Update Weight).
- Diary and Profile are app-bar shells until M2 / M8.
- Startup covers config → logger → i18n only; SQLite, seed, launch-screen hold and the recovery screen are M1 (ARCH-17, ARCH-13). A config error currently throws at startup.
- Typed route builders (ARCH-06) are added per route as screens land; M0 has only the tab roots.
- Any Portuguese device language (e.g. `pt-BR`) uses the pt-PT translation, since it is the only Portuguese one; number/date formatting still follows the device locale (SCOPE-12).
- Icons use Ionicons (outline; filled only for selected states), DS-06.

### Open questions
- **M0-Q1** Light `textTertiary` `#7A847D` is 3.87:1 on `surface` and 3.63:1 on `canvas`, below DS-11's 4.5:1 (its `tokens.ts` comment says it passes). Proposal: change it to `#687169` (5.05 surface · 4.74 canvas · 4.52 surfaceSubtle), still visibly lighter than `textSecondary`. Until decided, primitives don't use `textTertiary` for text and the contrast test marks the pair as a known failure (`it.failing`).
