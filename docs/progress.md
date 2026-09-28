# Progress log (ROAD-03)

Single place for implementation status. Updated in the same commit as the work it describes. Accepted milestones' sections are in [progress-archive.md](progress-archive.md).

| Milestone | Status |
|---|---|
| M0 Skeleton | done |
| M1 Data + domain | done |
| M2 Diary (read) | done |
| M3 Quick Calories | done |
| M4 Custom foods + ruler | done |
| M5 Search + Open Food Facts | done |
| M6 USDA | in progress — implementation and Android live validation complete; independent review/readiness remains |
| M7 Meal Detail + copy | not started |
| M8 Profile | not started |
| M9 Hardening | not started |

Spec changes: 2026-09-28 DS-13 reduced to light theme · iOS + Android · one phone size · default text; the matrix moved to POST-13. ROAD-03: one-line task entries, accepted milestones archived.

## M6 USDA

Status: **in progress** · implementation and Android live validation complete; independent re-review/readiness pending under the user-approved key-rotation waiver

### Tasks

- [x] T1 USDA adapter and synthetic contract fixtures: `src/data/api/usda/{client,mapper}.ts` maps the documented search/detail shapes, promotes Foundation/SR Legacy/FNDDS over Branded within a search page, maps nutrient fallbacks and fibre-excluded carbs, produces per-type bases/servings, and maps missing/rejected keys, 404, 429 and bad responses to typed errors. The request reads the key from `CredentialsService` per call and sends it only in `X-Api-Key`; tests prove it is absent from URLs and error text (PROV-01/02/05/06/07/08/10/12, DATA-04/06/11/15, ARCH-10/11/13/15/18).
  - Changed: `src/data/api/usda/client.ts`, `src/data/api/usda/mapper.ts`, synthetic fixtures and focused mapper/client contract tests.
  - Checks: `npm test -- --runInBand src/data/api/usda` → 2 suites / 8 tests passed; `npm run check` → lint + typecheck + 58 suites / 389 tests passed (existing React `act`/open-handle warnings after passing tests).
  - Blocker: PROV-13's captured, trimmed real responses for search `egg` and detail Foundation `747997`, SR Legacy `174980`, FNDDS `2705413`, and Branded `2035482` cannot be recorded without a user-provided local USDA key. No key was requested, read, logged, committed, or substituted with `DEMO_KEY`; no live request/test was made.
  - Retry point: when the owner has configured a local USDA key for the dev-only recorder, capture and trim only the PROV-02 fields, commit no headers/keys, and verify the explicit expected mapper outputs.
  - Next unblocked task: M6 Food Databases key flow (UX-18), while captured-fixture recording remains deferred as above.
- [x] T2 Food Databases and Food Search USDA integration: startup now constructs the USDA client with `CredentialsService`; Food Search adds a 400 ms/two-character USDA section after OFF, safely upserts selected detail responses with the 90-day USDA cache TTL, and renders missing/rejected/rate-limited/retry/offline states. Profile now exposes Food Databases with secure, masked key add/replace/test/remove and confirmation; local validation rejects whitespace and `DEMO_KEY`, and test/save behavior keeps an old key until a replacement passes (UX-04/18/19, NAV-06/08/09, DATA-01/15, ARCH-07/10/12/13/15/18/22, PROV-01/02/04/06/08/10/11/12).
  - Changed: `src/bootstrap/services.tsx`, `src/data/secure-storage/credentialsService.ts`, USDA Food Search queries/screen/route, Profile Food Databases route/screen, navigation routes and both locale files.
  - Checks: focused USDA credentials/client/Food Search/routes/locales tests passed; `npm run check` → lint + typecheck + 58 suites / 389 tests passed (existing React `act`/open-handle warnings after passing tests).
  - Known validation gap: UI-level Food Databases test doubles and Android device exercise remain for the next M6 test/QA task; no real key, URL, fixture or log was used.
  - Next unblocked task: M6 focused Food Databases/search integration tests and `npm run check`.
- [x] T3 Food Databases/search integration tests and Android QA attempt: focused UI tests cover secure/masked input, local invalid keys, replacement retention, 200/401/403/429/reachability `Test key` paths, removal confirmation, key-state retention, Food Search missing/rejected/rate-limited/retry/offline states, generic USDA ordering, selection/upsert, and navigation callbacks. The test path found and fixed two PROV-11 gaps: 429 now has its required explanatory message, and a failed `Test key` reachability check preserves the existing session status.
  - Changed: `src/features/profile/screens/__tests__/FoodDatabasesScreen.test.tsx`, `src/features/food-search/__tests__/FoodSearchScreen.test.tsx`, `src/features/profile/screens/FoodDatabasesScreen.tsx`, locale strings, and `docs/qa/M6/android-food-databases-2026-09-27.md`.
  - Checks: focused USDA/profile/search tests → 5 suites / 32 tests passed; `npm run check` → lint + typecheck + 59 suites / 399 tests passed (existing React `act` and open-handle warnings after passing tests).
  - Android QA: blocked before launch because this environment exposes no Android emulator, device, or mobile app target; exact evidence and retry path are in `docs/qa/M6/android-food-databases-2026-09-27.md`. No live USDA search or real key was used or claimed.
  - Blocker: PROV-13 captured USDA fixtures remain blocked until the owner provides a local key; this task did not request, read, or substitute one.
  - Next unblocked task: M6 independent review/acceptance preparation; Android device QA and captured-fixture recording remain deferred to their stated environment/key prerequisites.
- [x] T4 USDA captured fixtures and Android QA: captured the requested USDA search/detail responses through a one-process, stdin-only recorder, then sanitized them to the fields the mapper reads. Explicit fixture tests pin generic-first `egg` ordering and Foundation `747997`, SR Legacy `174980`, FNDDS `2705413`, and Branded `2035482` normalized output (PROV-13). The Android emulator exercised Food Databases empty/masked/local-validation/save/test states with redacted evidence. It exposed and fixed a production transport bug: leading request paths discarded the configured `/fdc/v1` base path. The client contract test now asserts complete search/detail URL paths.
  - Changed: `scripts/capture-usda-fixtures.mjs`, USDA captured fixtures and mapper tests, `src/data/api/usda/client.ts` + client tests, `docs/qa/M6/usda-fixtures-and-android-2026-09-27.md`, redacted Android evidence.
  - Checks: `npm test -- --runInBand src/data/api/usda` → 3 suites / 13 tests passed; `npm run check` → lint + typecheck + 60 suites / 404 tests passed (pre-existing React `act` and open-handle warnings after passing tests).
  - Android result: partial. The device is connected and Profile → Food Databases showed the expected empty/masked/saved controls. The first live test exposed the fixed base-path bug; after Metro reload, the live USDA query did not reach an addable selection in the QA window. The exact commands, results, and redacted evidence are in `docs/qa/M6/usda-fixtures-and-android-2026-09-27.md`.
  - Validation still needed: rerun the live USDA search → detail → add flow after confirming the provider response on the fixed client. The first failed local recorder invocation echoed the owner-supplied key in terminal output before capture; repository artifacts remain clean, but the key MUST be rotated and is not used again.
  - Next unblocked task: M6 live Android USDA selection/add rerun with a replacement key.
- [x] T5 Live Android USDA selection/add rerun: Food Search `egg` initially showed the sanitized `USDA search failed.` state; its in-screen Retry returned USDA results. The first USDA item was generic `Eggs, Grade A, Large, egg white` (Foundation `747997`), before any Branded USDA item. Selecting it opened Food Detail; `Add to Breakfast` returned immediately to Diary, which showed the new `1 × egg, white` / `19 kcal` Breakfast entry. No live fixture was recorded. Redacted evidence: `docs/qa/M6/android-live-usda-search-generic-first-2026-09-27.png`, `docs/qa/M6/android-live-usda-diary-updated-2026-09-27.png`; transient sanitized error evidence: `docs/qa/M6/android-live-usda-provider-failure-2026-09-27.png`.
  - Changed: `docs/progress.md`, `docs/qa/M6/android-live-usda-rerun-2026-09-27.md`, and the three redacted Android evidence images above.
  - Checks: Android emulator live path passed after one in-screen Retry. No code changed, so focused tests and `npm run check` were not duplicated.
  - Credential handling: no credential was entered, replaced, removed, copied, logged, captured, or committed during the live validation.
  - Next unblocked task: M6 independent review/readiness only; do not begin M7.
- [x] T6 Security review corrections: USDA transport and JSON-parser failures now map to static typed errors without retaining raw causes, which may contain credentialed URLs, request headers, query terms, or response bodies (ARCH-10/13/15, PROV-12). Focused tests inject credential-bearing request URL/header/body/cause values and inspect all error own properties (including `cause`), logger records, and USDA React Query keys; timeout and malformed JSON mappings remain typed.
  - Changed: `src/data/api/usda/client.ts`, `src/data/api/usda/__tests__/client.test.ts`, and `docs/progress.md`.
  - Checks: `npm test -- --runInBand src/data/api/usda/__tests__/client.test.ts` → 1 suite / 5 tests passed; `npm run check` → lint + typecheck + 60 suites / 406 tests passed (pre-existing React `act` and open-handle warnings after passing tests).
  - Credential incident decision: the owner explicitly waived rotation of the previously exposed local key on 2026-09-27. The factual exposure record remains above; independent M6 re-review/readiness may proceed. No credential or `.env` value was read, printed, used, modified, or committed for this correction.
  - Next unblocked task: independent M6 re-review/readiness only; do not begin M7.

### Known gaps

- Android E2E has no passing result: the emulator environment terminated Maestro after selecting Lunch before it emitted a result sentinel. The user explicitly waived that unavailable execution for M5; it does not block M6 work. M6’s Food Databases Android QA attempt also has no runnable target in this environment (see `docs/qa/M6/android-food-databases-2026-09-27.md`).

### Open questions

- ~~**M5-Q1**~~ Resolved 2026-09-27: approved `@react-native-community/netinfo` 12.0.1. It now drives TanStack Query's online state and the OFF section's offline status (ARCH-12); Android rebuild and Maestro validation remain in T4.

### Next unblocked task

- Independent M6 re-review/readiness only; do not begin M7.
