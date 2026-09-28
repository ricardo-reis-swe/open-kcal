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
| M6 USDA | awaiting user acceptance |
| M7 Meal Detail + copy | not started |
| M8 Profile | not started |
| M9 Hardening | not started |

Spec changes: 2026-09-28 DS-13 reduced to light theme · iOS + Android · one phone size · default text; the matrix moved to POST-13. ROAD-03: one-line task entries, accepted milestones archived.

## M6 USDA

Status: **awaiting user acceptance** · independent review passed (`docs/qa/M6/review.md`, reviewed HEAD `2282267`)

### Tasks

- [x] T1 USDA adapter + synthetic contract fixtures: `src/data/api/usda/{client,mapper}.ts` (ordering, nutrient fallbacks, fibre subtraction, typed errors, key only in `X-Api-Key`) with client/mapper tests.
- [x] T2 Food Databases + Food Search USDA integration: `src/bootstrap/services.tsx`, `src/features/profile/screens/FoodDatabasesScreen.tsx`, USDA section in `src/features/food-search/screens/FoodSearchScreen.tsx`, routes, locales.
- [x] T3 Food Databases/search UI tests (masked input, key check 200/401/403/429/unreachable, missing/rejected/busy/retry states): `src/features/{profile,food-search}/**/__tests__`; evidence `docs/qa/M6/android-food-databases-2026-09-27.md`.
- [x] T4 PROV-13 captured USDA fixtures + base-path fix: `scripts/capture-usda-fixtures.mjs`, `src/data/api/usda/__tests__/captured-fixtures.test.ts`; evidence `docs/qa/M6/usda-fixtures-and-android-2026-09-27.md`.
- [x] T5 Live Android USDA search → generic-first → add to Diary: evidence `docs/qa/M6/android-live-usda-rerun-2026-09-27.md` + screenshots.
- [x] T6 Security corrections (static typed transport/parse errors, no raw causes): `src/data/api/usda/client.ts` + tests; key-rotation waiver recorded by owner 2026-09-27 (`345fd72`).
- [x] T7 Review fixes: `ProviderConfigurationError.code` (`usda_key_missing`/`usda_key_rejected`) replaces message-text branching (ARCH-13); USDA "Show more" gated on the settled query like OFF: `src/shared/errors/errors.ts`, `src/data/api/usda/client.ts`, `FoodSearchScreen.tsx` + tests; review `docs/qa/M6/review.md`.

### Acceptance report (ROAD-03)

ROAD-02 checklist:
- [x] Main specs implemented (UX-18, PROV-02/05/06/11): adapter, Food Databases, key check + `Test key`, generic-before-Branded, fibre subtraction.
- [x] `npm run check` green at the milestone boundary (exit 0).
- [x] Focused tests for changed data/provider/navigation logic (USDA client/mapper/captured fixtures, credentials, Food Databases, Food Search, routes).
- [x] Android Maestro flow: n/a (M6 adds none, ARCH-18 table).
- [x] No placeholder UI for in-scope behavior.
- [x] Known gaps listed below.
- [x] ARCH-15: no key/diary content in logs; test asserts the key never reaches logger, errors or query keys (`client.test.ts`).
- [x] PROV-13 USDA fixtures (captured + synthetic, explicit expected outputs).

Exit demo: add a key, search USDA, log a food (T5, Android live); rejected-key and missing-key paths covered by UI tests.

### Known gaps

- PROV-12 dev-build diagnostic logging (provider, endpoint, status, Zod issue path) is not implemented in the USDA or OFF adapters (pre-existing since M5; review finding 3).
- Android E2E for M5 has no passing Maestro result (waived by the user for M5; not an M6 gate).

### Open questions

- None.

### Next unblocked task

- User acceptance of M6; M7 or M8 may start (ROAD-03).
