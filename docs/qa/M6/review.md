# M6 USDA — independent review

Reviewed HEAD: `2282267` (`228226792f7eb4a9e5bbc7770fee2d80601f0a4c`)
Commit range: `a2067fd..HEAD` (M6 work: `eb85d4c..bdb3b9c`; `345fd72` waiver note; `3fcc6ce`/`95f5a27` are an M5 post-acceptance fix; `4249d21`/`61f8dc8`/`2282267` are workflow-only)

## Verdict: pass

Main-spec behavior (UX-18, PROV-02/05/06/11) is implemented and matches the docs, including the generic-before-Branded ordering, fibre subtraction, per-provider fallback chains, PROV-11's key-check state machine (including the "reachability failure keeps prior status" case, confirmed live on device), and the ARCH-10/15 credential-safety guarantees. `npm run check` is green. Two non-blocking issues are worth fixing opportunistically (see findings).

## ROAD-02 checklist

- Every Main-spec behavior implemented — yes: USDA adapter (`src/data/api/usda/{client,mapper}.ts`), Food Databases screen, key check/Test key, generic-before-Branded (`mapper.ts:264-275`), fibre subtraction (`mapper.ts:99-101`) all present and unit-tested against the spec tables.
- `npm run check` green — yes: exit code 0, 60 suites / 407 tests passed (`/tmp/check.log`).
- Focused tests for changed domain/data/provider/navigation logic — yes: `src/data/api/usda/__tests__/{client,mapper,captured-fixtures}.test.ts`, `src/data/secure-storage/__tests__/credentialsService.test.ts`, `src/features/profile/screens/__tests__/FoodDatabasesScreen.test.tsx`, `src/features/food-search/__tests__/FoodSearchScreen.test.tsx`, `src/shared/navigation/__tests__/food-routes.test.ts`.
- Android Maestro flow if one exists — n/a, M6 adds none per `docs/08-roadmap.md:44-46`.
- No placeholder UI for in-scope behavior — confirmed by reading `FoodDatabasesScreen.tsx` and `FoodSearchScreen.tsx` end to end; all UX-18/PROV-11 states are wired, not stubbed.
- Known gaps listed in progress log — yes: Android E2E has no passing Maestro result (waived, pre-existing); no M6-specific gap open.
- ARCH-15 nothing sensitive in logs — yes: `src/shared/logging/logger.ts` redacts key/search-term-shaped context keys; a dedicated test (`client.test.ts` "ARCH-10/13/15/ROAD-02") asserts the key never reaches the logger, thrown errors, or query keys. The earlier local-terminal key exposure (`0ce7374`/`40b5e0b`/`74b32f2`) left no residue in the repo (checked `.env`, fixtures, docs — clean); rotation was explicitly waived by the owner (`345fd72`).
- PROV-13 USDA fixtures — yes: captured (`search-egg`, detail `747997`/`174980`/`2705413`/`2035482`) + synthetic (958/957/kJ-only fallback, 401, 429-with-`Retry-After`) fixtures, each with an explicit expected mapper output, matching the required-fixtures table in `docs/07-providers.md:266-278`.
- Test asserting the key never reaches logger/errors/query keys — yes: `src/data/api/usda/__tests__/client.test.ts` lines 78-115.

## Evidence

- `npm run check`: exit 0, 60/60 suites, 407/407 tests.
- Live Android spot-check (this review, emulator-5554, reusing the running dev build/Metro — no rebuild needed since M6 changed no native deps): Food Databases screen showed a saved key (masked `••••OVlV`), status `Saved · will check when online`, and a `Couldn't reach USDA. Try again.` inline error from a failed background `Test`, with the status correctly left unchanged rather than flipped to rejected — this is exactly PROV-11's "reachability failure keeps the existing status" rule, observed live. No credential was read, entered, changed, or printed; device state was not otherwise touched.
- Prior QA evidence (`docs/qa/M6/*.md`, screenshots) already covers add-key / search USDA / generic-before-Branded / log-to-diary on Android (T5), and local-validation / masked-input / test-key states (T3/T4). Rejected-key and missing-key paths are covered by explicit UI tests (`FoodSearchScreen.test.tsx` PROV-10/PROV-11 `it.each` at line ~250, `FoodDatabasesScreen.test.tsx`), which is sufficient given ROAD-02 marks exit-demo screenshots as optional.

## Findings

1. **[major]** ARCH-13 requires infra errors be mapped to typed errors so "callers branch on `category`, never on message text" (`src/shared/errors/errors.ts:1-3`), but `UsdaError` in `src/features/food-search/screens/FoodSearchScreen.tsx:585` distinguishes PROV-12's `usda_key_missing` vs `usda_key_rejected` states by parsing the error's free-text `message` (`error.message.includes('missing')`). `ProviderConfigurationError` (`src/shared/errors/errors.ts:84-86`) carries no discriminating field for this, so the client (`src/data/api/usda/client.ts:25` vs `:57`) and the screen are coupled only through wording. Repro: change either message string and the "Add a USDA API key" vs "USDA rejected your key" UI states silently swap. This is exercised on every USDA missing-key/rejected-key search (a common path), so it's a visible violation of an explicit architecture rule, not just a style nit. Fix: add a `code` (or similar) field to `ProviderConfigurationError`, e.g. `'usda_key_missing' | 'usda_key_rejected'`, and branch on that.

2. **[minor]** In `FoodSearchScreen.tsx`, the USDA "Show more" row (`usda.hasMore` at line 412) is not gated on `usdaQuery === query.trim()` the way the OFF section's equivalent is (`off.hasMore && query.trim() === offQuery` at line 360). While the user is still inside the 400 ms USDA debounce window after changing the query, a stale `usda.hasMore` from the previous term can make "Show more" appear/disappear inconsistently with the "Searching…" placeholder above it, and a tap would page the *previous* search term. Cosmetic only — data is replaced once the debounce settles — but worth aligning with the OFF pattern for consistency.

3. **[minor]** PROV-12 says "Dev builds log provider, endpoint, status and Zod issue path" for provider failures. Neither `src/data/api/usda/client.ts`/`mapper.ts` nor the sibling OFF adapter call the app logger anywhere, so this diagnostic logging isn't implemented for USDA (pre-existing gap, not introduced by M6, and not required by any test — flagging so it isn't lost).
