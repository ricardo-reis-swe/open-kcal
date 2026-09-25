# 04 Architecture (ARCH)

Read when: choosing libraries, placing code, handling errors/network/logging, or writing tests.

## ARCH-01 Stack
| Area | Decision |
|---|---|
| Framework | React Native on the latest stable Expo SDK at implementation start; **development builds** + Continuous Native Generation (Expo Go is not the permanent dev runtime) |
| Platforms | iOS + Android. Web is NOT a deliverable and must not influence storage, navigation or interaction decisions unless explicitly added to scope. |
| Language | TypeScript strict |
| Navigation | Expo Router |
| DB | `expo-sqlite`, repository-owned SQL, **no ORM** |
| Secrets | `expo-secure-store` |
| Async data | TanStack Query |
| UI state | React state + small scoped contexts; **no global store** |
| Forms / validation | React Hook Form / Zod |
| Localization | `expo-localization` + `i18next` / `react-i18next` (ARCH-22) |
| Gestures / motion / haptics | Gesture Handler + Reanimated / `expo-haptics` |
| Tests | Jest (`jest-expo`) + RN Testing Library; Expo Router testing utils; Maestro E2E |

- Pin versions from the Expo SDK compatibility matrix; commit the lockfile; no floating ranges in CI/release. Install native packages with `npx expo install`.
- Generated native dirs must not become the primary location for hand-written app logic.
- Go bare only if a confirmed requirement can't be met by Expo modules, config plugins or a small local Expo module. Excluded features (SCOPE-10) don't count.
- The no-ORM decision is reversible later, which is why DB access sits behind repositories.

## ARCH-02 Code quality
- No implicit `any`; strict null checks; typed route params, DB rows and domain models; exhaustive switches on unions (e.g. `entry_kind`).
- ESLint (Expo + hooks rules), Prettier, `tsc` as its own CI step. Add import-boundary lint rules if the layers start to erode.
- Generated types never replace runtime validation of untrusted data.

## ARCH-03 Validation (Zod) at every boundary
Form submits · route params · USDA responses · OFF responses · secure-storage reads · SQLite rows where corruption/migration mismatch must be caught · public env config.
- Domain schemas turn display input into command values (e.g. a localized weight string → number + unit); the service does the canonical conversion.
- API schemas accept only the fields we use and ignore the rest. A missing nutrient → `null`, never 0.
- React Hook Form for multi-field and validated forms, including: Quick Calories, custom food, goals, meal add/edit, units, weight goal, weight entry, USDA key. Tiny one-action controls don't need a form.

## ARCH-04 Layers
```text
src/app (routes) → features (screens, components, hooks, services) → domain (pure)
                                                 ├→ repository interfaces → SQLite impls (src/data/db)
                                                 └→ service interfaces → USDA, OFF clients (src/data/api), CredentialsService (src/data/secure-storage)
```
- Route files: compose navigation, validate params, render a feature screen. Minimal logic.
- Screens: render view models, own ephemeral state, dispatch intents. MUST NOT contain SQL, provider parsing, secure-storage access or nutrition math.
- Application services: cross-repo/transactional workflows (add/edit entry, copy meal, delete+reassign meal, create-then-select custom food, refresh external food, save/remove USDA key).
- Domain: pure types + math (serving/nutrition calc, unit conversion, goal resolution, local-date ops, unknown-macro aggregation). MUST NOT import React, Expo, SQLite, navigation or network.
- Infrastructure: repositories, migrations, secure storage, HTTP, clock, ID generation, logging.

## ARCH-05 Project structure
```text
assets/
src/
├── app/                 # Expo Router files only
├── features/{diary,food-search,meals,goals,profile,settings,weight}/{components,hooks,screens,services} + <feature>.queries.ts
├── domain/{diary,food,nutrition,units,weight}/
├── data/db/{migrations,repositories,schema}/ + database.ts
├── data/api/{usda,open-food-facts}/
├── data/secure-storage/
├── shared/{components,hooks,validation,errors,logging,dates,testing,theme,navigation,i18n}/
└── bootstrap/{providers.tsx,initialize-app.ts}
```
- Features may import domain + shared. Domain imports nothing above it. A feature must not reach into another feature's internals; move shared logic to domain/shared behind an interface.
- Path aliases only for top-level boundaries.
- Route tree (conceptual): `(tabs)/diary/{index, meal/[mealId], food-search, food/[foodId], entry/[entryId], quick-calories, quick-calories/[entryId], custom-food}`, `(tabs)/profile/{index, goals, meals/{index,[mealId]}, units, weight-goal, weight-history, food-databases}`, top-level modals `date-picker, meal-picker, serving-unit-picker, copy-meal, weight-entry`.

## ARCH-06 Navigation implementation
- Custom tab bar: Diary + Profile are tab routes; `+` is a custom button opening the Add Action Sheet, never selected.
- The selected date lives in a Diary-scoped context above the Diary stack. Params may initialize or change it; screens MUST NOT keep competing date state.
- Typed route builders (`src/shared/navigation/routes.ts`) so required params can't be omitted.
- Full-screen tasks and platform modals are routes when they need history, deep linking or independent back behavior. Light pickers/action sheets may be in-route, using ONE internal `BottomSheet` component (never a third-party sheet API directly).
- System back, swipe-dismiss, backdrop tap and the close button all run the same cancel path.

## ARCH-07 State
| Kind | Where |
|---|---|
| Persistent domain | SQLite via repositories/services. Invalidate/update queries **after commit**. |
| Async resources | TanStack Query: SQLite screen models, invalidation after mutations, USDA/OFF requests, loading/error/retry/cancel/freshness, dedupe. |
| Ephemeral UI | Local state: open/closed, search text, ruler drag, temp selections, unsaved forms. |
- Scoped contexts only when state genuinely spans a route group or subtree. Expected: Diary selected date, theme/tokens (if needed), services/DB.
- DO NOT persist the TanStack Query cache (SQLite + DATA-15 already define persistence).
- Add a global store only after a concrete cross-feature problem that SQLite, query, route or scoped context can't handle.

## ARCH-08 Data flow
- Read: screen → query hook → repository/query service → SQLite (+ remote if needed) → validated domain → view model.
- Write: validated command → application service → transaction/secure op → commit → invalidate → UI.
- NO optimistic display of local DB writes. Diary entries always commit locally before success is reported, even when remote work is involved.

## ARCH-09 SQLite runtime
- One provider opens the DB at startup: foreign keys ON → WAL where supported → migrations → idempotent seed → report recoverable failure (never reset).
- Async APIs only; sync calls only for tiny proven startup steps. Always bound params; NEVER interpolate user data into SQL.

## ARCH-10 Credentials
- `CredentialsService` is the only module touching the key: `hasUsdaApiKey()`, `getUsdaApiKeyForRequest()`, `saveUsdaApiKey(v)`, `removeUsdaApiKey()`.
- The key MUST NOT enter query keys, state snapshots, SQLite, logs, error messages or committed fixtures. Secure storage is not a general DB.

## ARCH-11 Food providers
- Interface `FoodSearchProvider { search(query, page, signal); getFood(externalId, signal); mapToCandidate(payload) }`.
- Normalized candidate: source, externalId, name, brand?, nutrition basis, known nutrients, valid servings, refresh metadata. Raw payloads never reach screens or domain.
- USDA: fetch the key from `CredentialsService` per request; never keep it in state or errors. A missing key is a typed `ProviderConfigurationError`, and search continues with custom/recent/cache/OFF.
- OFF: send documented identification headers; keep a responsible request rate; tolerate incomplete records; drop results missing the minimum data needed to display and log.
- Shared HTTP wrapper: `AbortController` cancel, finite timeout, typed HTTP/timeout/offline/parse/config errors, redacted diagnostics, limited retry with exponential backoff + jitter for transient errors only. NO auto-retry on invalid request, auth failure, schema failure, or 429 without honoring server guidance.

## ARCH-12 Offline
| Capability | Offline |
|---|---|
| Diary view/nav, Quick Calories, add/edit cached or custom food, edit/copy meals, goals/meals/units/weight, search custom + recent | Full |
| Search cached external foods | Yes, with a stale/cache indicator when appropriate |
| Remote USDA/OFF search | Unavailable until online |
| Save USDA key | Saved; validation may wait until online |
- A network failure MUST NOT replace local results with a full-screen error: show local results + inline per-provider status.
- Wire TanStack `onlineManager` to RN connectivity. Foreground may re-check stale remote queries, but must not make unrelated diary queries refetch from the network. No background search queue; the user retries.

## ARCH-13 Errors
- Typed: `ValidationError, NotFoundError, ConflictError, DatabaseError, MigrationError, SecureStorageError, OfflineError, TimeoutError, RateLimitError, ProviderConfigurationError, ProviderResponseError, UnexpectedError`. Map infra errors to these before feature code sees them; never parse message strings.
- User messages describe recovery; they never expose SQL, credentialed URLs, payloads or stacks.
- Fatal startup/migration failure → safe recovery screen with retry + diagnostic guidance; never an auto reset. React error boundaries isolate unexpected screen-render failures with a route-safe retry/return.

## ARCH-14 Config
- Public build-time config via Expo env (`EXPO_PUBLIC_*`): provider base URLs, build channel/variant, non-secret diagnostics IDs. Treat all client env as public.
- The USDA key is user runtime data: NEVER in `.env`, `EXPO_PUBLIC_*`, app config or EAS secrets.
- Commit `.env.example` with placeholders; local overrides stay gitignored. Validate env once at startup in a typed config module; features never read `process.env`.
- When distribution starts, use separate app IDs/names for dev/preview so test builds don't overwrite production data.

## ARCH-15 Logging and privacy
- All logging goes through the app logger interface (`debug/info/warn/error`). Release builds redact/omit: USDA key, search terms (when not needed), diary contents, body weights, Quick Calories notes, raw payloads, full rows.
- Migrations log only version, duration and outcome category.
- No analytics in the MVP. An optional crash reporter (pre-release) goes behind the logger interface, excludes health data and secrets, gets its privacy impact documented, and nothing may depend on it.

## ARCH-16 Gestures and haptics
- Ruler: drag/animation on the UI thread where practical; emit the quantity to React state at controlled intervals + on gesture end.
- `HapticsService` wraps `expo-haptics`: can be disabled in tests, throttled during fast ruler moves, adapted per platform, and replaced or disabled for accessibility/preference. Haptics fire only on snapped meaningful ticks.
- Gesture ownership: dragging inside the ruler = ruler; swiping elsewhere on the Diary = change day.

## ARCH-17 Startup
Validate config → logger → open SQLite → pragmas → migrate + seed → secure storage → repositories/services → Query client → providers + Router → requested route.
- The launch screen stays until config + migration succeed. Network is not required. USDA key presence may be checked afterwards and never blocks the diary.

## ARCH-18 Testing
| Layer | Tool | Must cover |
|---|---|---|
| Domain unit | Jest, no RN/network | Unit conversion, serving/nutrition math, unknown-macro aggregation, effective goals, local dates across month/year/DST/leap day, Zod schemas, provider mapping, retry classification |
| Repository/migration | Real SQL on a disposable SQLite DB (never mock the repository) | Init + idempotent seed, every forward migration, FK/constraints, rollback, meal delete+reassign, snapshot preservation, unknown-macro aggregation, cache upsert/expiry |
| Component | RNTL + `jest-expo`; query by role/label/text/user-event; no snapshot-first tests | Loading/empty/populated/error, a11y labels and actions, form validation, direct entry navigation, configurable meals, Quick Calories unknown macros |
| Navigation | Expo Router in-memory testing | Tabs, modal dismiss, param validation, direct edit paths, return after save/delete/reassign, date preservation |
| API contract | Sanitized fixtures (PROV-13); no live calls in CI (scheduled live check: POST-08) | Known shapes + edge cases, missing fields |
| E2E | Maestro, seeded deterministic DB, no live providers | Launch to today; add food from a meal; Quick Calories; direct edit + delete; swipe date + back to today; reorder meals; add + edit weight; offline cached/custom food |

## ARCH-19 Performance
Indexed, bounded queries · totals aggregated in SQL · debounce remote search + cancel stale requests · paginate providers and large lists · virtualized lists · ruler off the JS thread · no sync SQLite in interaction paths · measure before memoizing. Must keep reduced-motion support and reliable value updates.

## ARCH-20 Dependencies
- Add one only if it: meets an approved requirement or a demonstrated need; supports the Expo SDK on both platforms; is maintained and documented; needs no account/backend/paid service for core behavior; has acceptable size/native/privacy/maintenance cost; can sit behind an internal interface at domain/infra boundaries.
- Prefer Expo-maintained packages. One router, one DB, one form lib, one validation lib; no global store until justified; no second persistence cache.
- Every dependency must satisfy a recorded product or engineering need. A major one needs a short architecture note: problem, choice, rejected options, migration cost.

## ARCH-22 Localization
- `expo-localization` (device locale/region) + `i18next` / `react-i18next`. Languages: `en` (fallback) and `pt-PT` (SCOPE-12). Add an `Intl.PluralRules` polyfill if the Hermes build lacks it.
- Strings live in `src/shared/i18n/locales/{en,pt-PT}.json`. Every user-facing string goes through `t()`. No concatenation: use interpolation. Plurals use i18n plural keys.
- A missing pt-PT key falls back to en. CI fails if the two files have different key sets.
- Numbers, dates and units are formatted with `Intl` in the app locale (comma decimal and day-first dates in pt-PT). Parsing accepts the locale's decimal separator (DS-09).
- pt-PT means European Portuguese wording (`ecrã`, `pequeno-almoço`), not Brazilian.
- Component tests run in `en`, plus one render smoke test per screen in `pt-PT` to catch overflow and missing keys.

## ARCH-21 Official docs
Check the current versions: Expo [dev builds](https://docs.expo.dev/develop/development-builds/use-development-builds/) · [Router](https://docs.expo.dev/versions/latest/sdk/router/) · [SQLite](https://docs.expo.dev/versions/latest/sdk/sqlite/) · [SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/) · [Haptics](https://docs.expo.dev/versions/latest/sdk/haptics/) · [env vars](https://docs.expo.dev/guides/environment-variables/) · [unit testing](https://docs.expo.dev/develop/unit-testing/) · [Router testing](https://docs.expo.dev/router/reference/testing/) · [TanStack Query](https://tanstack.com/query/latest/docs/framework/react/overview) · [React Hook Form](https://react-hook-form.com/) · [Zod](https://zod.dev/).
