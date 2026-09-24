# Section 4 — Application Architecture and Technology Stack

## Purpose

This section defines the technical foundation for the calorie tracker MVP: framework, libraries, application boundaries, project structure, data flow, offline behavior, configuration, diagnostics, and testing.

The goal is a durable architecture for a local-first mobile app without adding infrastructure that the approved MVP does not need.

---

## Architecture decision summary

| Area | Decision |
| --- | --- |
| Mobile framework | React Native through the latest stable Expo SDK available when implementation begins |
| Platforms | iOS and Android |
| Language | TypeScript in strict mode |
| Native project workflow | Expo development builds with Continuous Native Generation |
| Navigation | Expo Router |
| Local database | `expo-sqlite` with repository-owned SQL and migrations |
| Secret storage | `expo-secure-store` |
| Async data coordination | TanStack Query |
| Ephemeral UI state | React component state and small scoped contexts |
| Forms | React Hook Form |
| Runtime validation | Zod |
| Gestures and motion | React Native Gesture Handler and Reanimated |
| Haptics | `expo-haptics` |
| Unit and component tests | Jest through `jest-expo` and React Native Testing Library |
| Navigation integration tests | Expo Router testing utilities |
| End-to-end tests | Maestro for the critical success flows |

Exact dependency versions must be selected from the chosen Expo SDK's compatibility matrix and committed in the lockfile. The project must not use floating dependency ranges in CI or release builds.

---

## Framework choice

### Use Expo with development builds

The MVP should be built with React Native through Expo rather than starting as a manually configured bare React Native project.

Expo provides maintained integrations for the native capabilities already required by the approved plan:

- SQLite.
- Secure credential storage.
- Haptics.
- Native routing and screen presentation.
- Development and release builds for iOS and Android.

The project should use an Expo development build instead of relying on Expo Go as its permanent development runtime. Development builds allow the app to include and configure its actual native dependencies while retaining the normal Expo developer experience.

Continuous Native Generation keeps the native iOS and Android projects reproducible from application configuration and config plugins. Generated native directories should not become the primary location for hand-written app logic.

### When a bare workflow would become justified

Starting bare is not justified by the MVP. Reconsider the workflow only if a confirmed requirement cannot be met through Expo modules, config plugins, or a small local Expo module.

Barcode scanning, health-platform integrations, and other excluded capabilities are not valid reasons to add native complexity now.

### Platform scope

The supported product platforms are:

- iOS.
- Android.

Expo Router can support web, but web is not an MVP deliverable. Web-specific work must not influence storage, navigation, or interaction decisions unless web is explicitly added to scope later.

---

## Language and code-quality baseline

All application code uses TypeScript with strict compiler settings.

Required expectations include:

- No implicit `any`.
- Strict null checks.
- Typed route parameters.
- Typed database rows and domain models.
- Exhaustive handling of discriminated unions such as diary-entry kinds.
- Runtime validation at every external or persistence boundary.

Static analysis should include:

- ESLint with Expo and React hooks rules.
- Prettier for mechanical formatting.
- Type checking as a separate CI command.
- Import-boundary rules if architectural boundaries begin to erode.

Generated API or database types, if later introduced, must not replace validation of untrusted runtime data.

---

## Navigation architecture

### Expo Router

Expo Router provides file-based routing over React Native navigation primitives. Route files define navigation composition while feature modules own the actual screen behavior.

Use route groups for the two persistent tab destinations and top-level modal routes for app-wide overlays.

Conceptual route tree:

```text
src/app/
├── _layout.tsx
├── (tabs)/
│   ├── _layout.tsx
│   ├── diary/
│   │   ├── _layout.tsx
│   │   ├── index.tsx
│   │   ├── meal/[mealId].tsx
│   │   ├── food-search.tsx
│   │   ├── food/[foodId].tsx
│   │   ├── entry/[entryId].tsx
│   │   ├── quick-calories.tsx
│   │   ├── quick-calories/[entryId].tsx
│   │   └── custom-food.tsx
│   └── profile/
│       ├── _layout.tsx
│       ├── index.tsx
│       ├── goals.tsx
│       ├── meals/
│       │   ├── index.tsx
│       │   └── [mealId].tsx
│       ├── units.tsx
│       ├── weight-goal.tsx
│       ├── weight-history.tsx
│       └── food-databases.tsx
├── date-picker.tsx
├── meal-picker.tsx
├── serving-unit-picker.tsx
├── copy-meal.tsx
└── weight-entry.tsx
```

This tree is conceptual rather than a requirement to place full implementations in route files. Each route file should normally import and render a feature-owned screen component.

### Custom bottom navigation

The tab layout implements exactly:

```text
Diary                 +                 Profile
```

Diary and Profile are actual tab routes. The center `+` is a custom tab-bar action that opens the Add Action Sheet and never becomes selected.

The selected diary date is owned by a Diary-scoped context above the Diary stack. Route parameters may initialize or explicitly change the selected date, but individual screens must not create competing date state.

### Route parameters

Routes pass stable identifiers and date strings, never serialized database objects. Route input is untrusted and must be validated before use.

Use typed helpers for route construction so a caller cannot accidentally omit `entryId`, `mealId`, `date`, or source information required by the contracts in Section 2.

### Modal and sheet presentation

Full-screen tasks and platform modals are represented as routes when they need navigation history, deep linking, or independent back behavior.

Lightweight pickers and action sheets may use an accessible bottom-sheet primitive within the current route. The UI layer should expose one internal Sheet component rather than allowing features to depend directly on a third-party sheet API. This makes the underlying implementation replaceable.

The system back button, swipe-to-dismiss gesture, backdrop tap, and explicit close control must converge on the same cancel behavior.

---

## Persistence stack

### SQLite

Use `expo-sqlite` as the direct SQLite driver.

The database opens through one application-level provider during startup. Its initialization callback:

1. Enables foreign keys.
2. Enables write-ahead logging where supported.
3. Applies pending migrations.
4. Creates idempotent seed data.
5. Reports a recoverable startup failure without silently resetting user data.

Use asynchronous database APIs for normal application work. Synchronous database calls are limited to tiny, proven startup operations because they can block the JavaScript thread.

All user-controlled values use bound parameters or prepared statements. User data must never be interpolated into SQL strings.

### No ORM in the initial MVP

The initial schema is compact and contains domain-specific aggregates and transactions. Direct, repository-owned SQL keeps those operations explicit and avoids adding an ORM, code generator, and migration abstraction before they provide measurable value.

This is a reversible decision. An ORM or typed query builder may be evaluated later if schema growth creates repeated mapping errors or migration maintenance becomes costly. Database access behind repositories prevents that choice from leaking into screens.

### Secure storage

Use `expo-secure-store` for the user-supplied USDA API key.

A `CredentialsService` is the only module allowed to read, write, or remove the key. Callers receive capability-oriented methods such as:

```text
hasUsdaApiKey()
getUsdaApiKeyForRequest()
saveUsdaApiKey(value)
removeUsdaApiKey()
```

The key must not enter TanStack Query keys, application state snapshots, SQLite, logs, error messages, or test fixtures committed to the repository.

Secure storage is not used as a general application database. It is appropriate for the small credential value, not diary or cache records.

---

## State-management strategy

The app has three distinct forms of state. They must not be combined into one global store.

### Persistent domain state

SQLite is the source of truth for meals, diary entries, foods, goals, weight records, and preferences.

Screens access this state through feature services and repositories. A successful mutation invalidates or updates the corresponding query data after the transaction commits.

### Async resource state

TanStack Query coordinates:

- Loading SQLite-backed screen models.
- Invalidating diary, meal, goal, and weight views after mutations.
- USDA and Open Food Facts requests.
- Loading, error, retry, cancellation, and freshness state.
- Deduplication of concurrent requests.

TanStack Query is not the durable store. Its cache can be discarded and reconstructed from SQLite or remote sources.

Do not persist the entire TanStack Query cache in the MVP. SQLite already persists the data that must survive restarts, and remote food records have an explicit cache model from Section 3. A second generic persisted cache would create competing freshness rules.

### Ephemeral presentation state

Use local React state for:

- Open or closed UI elements.
- Search-field text before submission.
- Ruler drag state.
- Temporary selections.
- Unsaved form state.

Use small scoped React contexts only when state genuinely spans a route group or component subtree. Initial contexts are expected for:

- Diary selected date.
- Theme/design tokens if needed.
- Application services and database access.

Do not add a global state library at project creation. Add one only after a concrete cross-feature state problem cannot be expressed cleanly through SQLite, query state, route state, or a scoped context.

---

## Forms and runtime validation

### React Hook Form

Use React Hook Form for multi-field and validated forms, including:

- Quick Calories.
- Custom food creation.
- Nutrition goals.
- Meal add/edit.
- Unit preferences.
- Weight goal and weight entry.
- USDA API key configuration.

Very small one-action controls do not need to become forms.

### Zod schemas

Zod schemas define runtime validation for:

- Form submissions.
- Route parameters.
- USDA responses.
- Open Food Facts responses.
- Data read from secure storage.
- Parsed SQLite rows where corruption or migration mismatch must be detectable.
- Public environment configuration.

Domain schemas should transform display input into explicit command values. For example, a weight form converts a localized user string into a validated numeric value plus selected unit before the application service performs canonical conversion.

API response schemas should accept only the fields the app uses and tolerate unrelated source fields. Missing optional nutrient data maps to `null`, never an invented zero.

---

## Gestures, ruler interaction, and haptics

Use React Native Gesture Handler and Reanimated for the serving ruler and other gesture-heavy interactions that must remain responsive during JavaScript work.

The ruler should keep drag position and animation work on the UI thread where practical. It emits a normalized selected quantity to React state at controlled intervals and on gesture completion.

Use `expo-haptics` through an internal `HapticsService` so feedback can be:

- Disabled in tests.
- Throttled during rapid ruler movement.
- Adapted per platform.
- Replaced or disabled for accessibility and user preference needs.

Haptics occur at meaningful snapped tick points, not on every movement event.

Horizontal diary paging must not compete with horizontal ruler gestures. Gesture ownership should be explicit: dragging inside the ruler controls the ruler, while swiping elsewhere on the diary changes the day.

---

## Application layers

Dependencies point inward toward the domain. Screens may initiate use cases but must not contain SQL, source-specific API parsing, secure-storage access, or nutrition calculations.

```text
Route files
    │
    ▼
Feature screens and components
    │
    ▼
Feature hooks and application services
    │
    ├── Domain models and pure calculations
    │
    ├── Repository interfaces
    │       └── SQLite implementations
    │
    └── External service interfaces
            ├── USDA client
            ├── Open Food Facts client
            └── Secure credentials service
```

### Route layer

Route modules define navigation composition, validate parameters, and render feature screens. They contain minimal product logic.

### Presentation layer

Screens and components render view models, own ephemeral interaction state, and dispatch user intents. They do not know table layouts or remote response formats.

### Application layer

Application services coordinate workflows that cross repositories or require transactions, including:

- Add or edit a diary entry.
- Copy a meal.
- Delete and reassign a meal.
- Create and then select a custom food.
- Refresh an external food.
- Save or remove the USDA key.

### Domain layer

Domain modules contain pure types and calculations:

- Serving conversion.
- Nutrition calculation.
- Unit conversion.
- Goal resolution rules.
- Local-date operations.
- Unknown-macro aggregation.

Domain code must not import React, Expo, SQLite, navigation, or network clients.

### Infrastructure layer

Infrastructure modules implement repositories, migrations, secure storage, HTTP clients, clocks, ID generation, and logging.

---

## Recommended project structure

```text
assets/
src/
├── app/                         # Expo Router route files and layouts
├── features/
│   ├── diary/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── screens/
│   │   ├── services/
│   │   └── diary.queries.ts
│   ├── food-search/
│   ├── meals/
│   ├── goals/
│   ├── profile/
│   ├── settings/
│   └── weight/
├── domain/
│   ├── diary/
│   ├── food/
│   ├── nutrition/
│   ├── units/
│   └── weight/
├── data/
│   ├── db/
│   │   ├── migrations/
│   │   ├── repositories/
│   │   ├── schema/
│   │   └── database.ts
│   ├── api/
│   │   ├── usda/
│   │   └── open-food-facts/
│   └── secure-storage/
├── shared/
│   ├── components/
│   ├── hooks/
│   ├── validation/
│   ├── errors/
│   ├── logging/
│   ├── dates/
│   └── testing/
└── bootstrap/
    ├── providers.tsx
    └── initialize-app.ts
```

Features may import domain and shared modules. Domain modules must not import features or infrastructure. One feature should not reach into another feature's internal folders; shared behavior moves to the domain or shared layer through an explicit interface.

Use path aliases for stable top-level boundaries, not for every folder.

---

## Data flow

### Read flow

```text
Screen
→ feature query hook
→ repository or application query service
→ SQLite and, when needed, remote client
→ validated domain records
→ screen view model
→ rendered UI
```

### Write flow

```text
User action
→ validated form/command
→ application service
→ transaction or secure-storage operation
→ successful commit
→ query invalidation or targeted cache update
→ refreshed UI
```

The UI must not optimistically display a local database mutation as saved before the transaction commits. Local SQLite writes are fast, so confirmed-write behavior is simpler and avoids showing data that did not persist.

Longer remote operations may show progress and use cached data, but creating a diary entry still commits locally before reporting success.

---

## Food-provider architecture

USDA and Open Food Facts implement a shared application-facing interface while preserving source-specific adapters.

```text
FoodSearchProvider
├── search(query, page, signal)
├── getFood(externalId, signal)
└── mapToCandidate(sourcePayload)
```

The shared result type contains only normalized fields required by the app:

- Source.
- External ID.
- Name.
- Optional brand.
- Nutrition basis.
- Known nutrient values.
- Valid serving options.
- Enough source metadata for later refresh.

Source-specific payloads never reach screens or domain calculations.

### USDA client

The USDA client obtains the API key from `CredentialsService` at request time. It does not retain the key in React state or include it in error details.

Missing-key behavior is a typed configuration error that allows Food Search to continue with custom foods, recent foods, cache, and Open Food Facts.

### Open Food Facts client

The client uses documented identification headers and a responsible request rate. It must tolerate incomplete community-provided records and exclude results that lack the minimum data required for safe display and logging.

### Request behavior

Both clients use a shared HTTP wrapper providing:

- Request cancellation through `AbortController`.
- A finite timeout.
- Typed HTTP, timeout, offline, parse, and configuration errors.
- Redacted diagnostic metadata.
- Limited retry with exponential backoff and jitter for transient failures.

Do not retry invalid requests, authentication failures, rate-limit responses without respecting server guidance, or schema-validation failures automatically.

---

## Offline and failure behavior

Local-first means the diary remains usable without network access.

| Capability | Offline behavior |
| --- | --- |
| View and navigate diary | Fully available from SQLite |
| Add Quick Calories | Fully available |
| Add or edit cached/custom food | Fully available |
| Edit or copy meals | Fully available |
| Change goals, meals, units, and weight | Fully available |
| Search custom and recent foods | Fully available |
| Search cached external foods | Available with a stale/cache indicator when appropriate |
| Search remote USDA or Open Food Facts | Unavailable until connectivity returns |
| Save USDA API key | Saved locally; validation may be deferred until online |

Network failure must not replace local search results with a full-screen error. Food Search shows local results and an inline provider status for failed remote sources.

Connect TanStack Query's online manager to React Native connectivity state so paused remote requests can resume intentionally. App foreground events may trigger stale remote-query checks, but they must not cause unrelated diary queries to refetch from the network.

The app does not queue food searches as background jobs. The user can retry when connected.

---

## Error model

Use typed application errors rather than parsing message strings.

Initial categories:

```text
ValidationError
NotFoundError
ConflictError
DatabaseError
MigrationError
SecureStorageError
OfflineError
TimeoutError
RateLimitError
ProviderConfigurationError
ProviderResponseError
UnexpectedError
```

Infrastructure errors are mapped to these types before reaching feature code. User-facing messages describe recovery actions without exposing SQL, URLs containing credentials, provider payloads, or stack traces.

Fatal startup failures, especially migration failures, show a safe recovery screen with retry and diagnostic guidance. They must not trigger an automatic database reset.

React error boundaries isolate unexpected screen-rendering failures and provide a route-safe retry or return action.

---

## Environment and configuration

Use Expo's environment-variable conventions for public build-time configuration such as:

- USDA and Open Food Facts base URLs.
- Build channel or app variant.
- Optional non-secret diagnostics endpoint identifiers.

Every variable included in client-side application code must be treated as public, even if supplied by a build service.

The user's USDA API key is runtime user data and therefore does not belong in `.env`, `EXPO_PUBLIC_*`, app configuration, or EAS build secrets. It belongs only in secure device storage.

Provide a checked-in `.env.example` containing names and safe placeholder values only. Local override files containing machine-specific values remain ignored by version control.

A typed configuration module validates public environment values once during startup. Feature modules import that validated configuration rather than reading `process.env` directly.

Maintain separate application identifiers and display names for development/preview builds when distribution begins, preventing test builds from overwriting production data on a device.

---

## Logging and diagnostics

All logging goes through a small application logger interface with `debug`, `info`, `warn`, and `error` levels.

Development builds may log detailed technical context. Release builds must redact or omit:

- USDA API keys.
- Food search terms when unnecessary.
- Food diary contents.
- Body weights.
- Notes attached to Quick Calories.
- Raw provider payloads.
- Full SQLite rows.

The MVP does not require analytics.

Before public release, a crash-reporting provider may be attached behind the logger/error-reporting interface. It must be configured to avoid collecting health-related content and secrets, and its privacy implications must be documented. Product behavior must not depend on that provider being available.

Database migrations log only version numbers, duration, and success/failure category, never user rows.

---

## Testing strategy

### Pure unit tests

Use Jest for domain and utility behavior, including:

- Unit conversions.
- Serving and nutrition calculations.
- Unknown-macro aggregation.
- Effective-dated goal selection.
- Local-date navigation across month, year, daylight-saving, and leap-day boundaries.
- Validation schemas.
- Provider response mapping.
- Retry classification.

These tests should run without React Native rendering or network access.

### Repository and migration tests

Run repository tests against disposable SQLite databases. Cover:

- Initialization and idempotent seeding.
- Every forward migration from supported prior versions.
- Foreign keys and constraints.
- Transaction rollback.
- Meal deletion and reassignment.
- Nutrition snapshot preservation.
- Diary aggregation with unknown macros.
- Cache upsert and expiration behavior.

Repository tests must use the real SQL statements rather than mocking the repository itself.

### Component tests

Use React Native Testing Library with `jest-expo` for components and screens. Prefer role, label, text, and user-event queries over implementation details.

Cover:

- Loading, empty, populated, and error states.
- Accessible labels and actions.
- Form validation.
- Direct diary-entry navigation.
- Configurable meal rendering.
- Quick Calories displaying unknown macros correctly.

Avoid broad snapshot testing as the primary assertion strategy.

### Navigation integration tests

Use Expo Router's testing utilities to render in-memory route trees and verify:

- Tab behavior.
- Modal dismissal.
- Route-parameter validation.
- Direct diary editing paths.
- Return behavior after saving, deleting, or reassigning an entry.
- Preservation of selected diary date.

### API contract tests

Keep sanitized USDA and Open Food Facts fixtures for known response shapes and edge cases. Tests validate mapping and missing-field behavior without calling live services during normal CI.

Optional scheduled checks may detect upstream contract changes, but a third-party outage must not make every application test run fail.

### End-to-end tests

Use Maestro for a small set of device-level critical flows:

- Launch to today's diary.
- Add a normal food from a configured meal.
- Add Quick Calories.
- Directly edit and delete a diary entry.
- Swipe to another date and return to today.
- Reorder meals.
- Add and edit weight.
- Use cached/custom foods while offline.

End-to-end tests use a deterministic seeded database and must not depend on live provider responses.

---

## Performance guidelines

- Keep database queries indexed and bounded.
- Aggregate daily totals in SQL rather than loading the entire diary history into JavaScript.
- Debounce remote search input and cancel obsolete requests.
- Paginate provider searches and large local result lists.
- Use virtualized lists for food results and long histories.
- Keep ruler animation work off the JavaScript thread where practical.
- Avoid synchronous SQLite calls in interaction paths.
- Measure before adding memoization or a global state library.

Performance work must preserve accessible reduced-motion behavior and reliable value updates.

---

## Dependency-selection rules

Add a dependency only when it:

- Solves an approved requirement or a demonstrated engineering need.
- Supports the chosen Expo SDK and both mobile platforms.
- Is actively maintained with clear documentation.
- Does not require an account, backend, or paid service for core app behavior.
- Has an acceptable bundle, native-build, privacy, and maintenance cost.
- Can be isolated behind an internal interface when it touches domain or infrastructure boundaries.

Prefer Expo-maintained packages for capabilities Expo already provides. Install native packages using Expo's compatibility-aware installation command.

Do not add competing solutions for the same responsibility. In particular:

- One router.
- One durable local database.
- One form-state library.
- One runtime schema-validation library.
- No generic global store until justified.
- No second implicit persistence cache alongside SQLite.

Major dependency additions require an architecture note recording the problem, chosen option, rejected alternatives, and migration cost.

---

## Startup sequence

The application starts in this order:

```text
Load and validate public configuration
→ initialize logger
→ open SQLite
→ enable database pragmas
→ run migrations and seed data
→ initialize secure-storage service
→ create repositories and application services
→ create TanStack Query client
→ mount providers and Expo Router
→ show the requested route
```

A lightweight launch screen remains visible until configuration and database migration succeed. Network connectivity is not required to finish startup.

USDA-key presence may be checked after secure storage initializes, but provider availability must not block access to the diary.

---

## Architecture acceptance criteria

Section 4 is satisfied when:

- The app can be developed and released for iOS and Android through Expo development builds.
- Route structure implements the approved Diary, central `+`, and Profile navigation without making `+` a tab destination.
- SQLite remains the only durable source of truth for ordinary application data.
- The USDA key is accessible only through the secure credential service.
- Screens contain no SQL or provider-specific payload handling.
- Domain calculations run independently of React Native and are unit-testable.
- Remote-provider failures do not prevent local diary use.
- Query caching does not duplicate the explicit persistent food cache.
- Form, route, API, and configuration boundaries perform runtime validation.
- Critical transactions and migrations have real SQLite tests.
- Critical user flows have component, navigation, and end-to-end coverage.
- Health-related user content and credentials are excluded from release logs and diagnostics.
- New dependencies must satisfy a recorded product or engineering need.

---

## Official implementation references

Use current official documentation when implementation begins:

- [Expo development builds](https://docs.expo.dev/develop/development-builds/use-development-builds/)
- [Expo Router](https://docs.expo.dev/versions/latest/sdk/router/)
- [Expo SQLite](https://docs.expo.dev/versions/latest/sdk/sqlite/)
- [Expo SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/)
- [Expo Haptics](https://docs.expo.dev/versions/latest/sdk/haptics/)
- [Expo environment variables](https://docs.expo.dev/guides/environment-variables/)
- [Expo unit testing](https://docs.expo.dev/develop/unit-testing/)
- [Expo Router testing](https://docs.expo.dev/router/reference/testing/)
- [TanStack Query for React](https://tanstack.com/query/latest/docs/framework/react/overview)
- [React Hook Form](https://react-hook-form.com/)
- [Zod](https://zod.dev/)

These links identify authoritative sources, not fixed package versions. Dependency versions remain pinned by the project lockfile and the chosen Expo SDK.
