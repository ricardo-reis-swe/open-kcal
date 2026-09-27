# M6 USDA captured fixtures and Android QA — 2026-09-27

## Captured fixtures (PROV-13)

- Captured with one short-lived local process, using `USDA_CAPTURE_KEY` read from process stdin; the recorder requested search `egg` and details `747997`, `174980`, `2705413`, and `2035482`.
- `scripts/capture-usda-fixtures.mjs --sanitize-existing` retained only adapter-read fields: identity/type/brand/basis fields, mapped nutrients, portions, and Branded label nutrients. No headers, credentials, URL credentials, or response metadata were written.
- Fixtures: `src/data/api/usda/__fixtures__/captured/`.
- Explicit persisted mapper expectations: `src/data/api/usda/__tests__/captured-fixtures.test.ts` covers search ordering plus Foundation, SR Legacy, FNDDS, and Branded detail outputs.
- Command: `npm test -- --runInBand src/data/api/usda`
- Result: 3 suites, 13 tests passed. No test calls the live API.

## Android emulator QA

- Target: `emulator-5554` (`sdk_gphone64_x86_64`), app `com.ricardoreis.calorietracker`.
- Commands: `adb devices -l`; `adb reverse tcp:8081 tcp:8081`; `npx expo start --dev-client --port 8081`; `adb shell am force-stop com.ricardoreis.calorietracker`; development-client deep link to local Metro.
- Food Databases: opened Profile → Food Databases; the empty state showed `USDA, Not set up`; password input exposed masked bullets only; the stored state exposed only its masked hint; `Test key` and removal controls appeared after save.
- Local validation: a whitespace-only entry and the documented demo key were exercised; the password field remained masked. Redacted evidence: `android-food-databases-empty-2026-09-27.png`, `android-food-databases-local-validation-2026-09-27.png`, `android-food-databases-demo-key-rejected-2026-09-27.png`.
- Runtime-key check: the owner-supplied key was entered only into the password-masked app field. The initial `Test key` reported `Couldn't reach USDA. Try again.` This exposed a real request-path defect: `new URL('/foods/search', baseUrl)` discarded the configured `/fdc/v1` path. The client now preserves that path and its contract test pins both search and detail URLs.
- After reloading Metro, the emulator showed the saved masked state and USDA search UI. The live USDA request did not produce a selectable USDA result before the QA window ended; Open Food Facts results remained visible. The post-fix live search/selection/add pass therefore remains required.
- Redacted evidence: `android-food-databases-saved-masked-2026-09-27.png`, `android-food-databases-key-tested-2026-09-27.png`, `android-food-databases-key-tested-active-2026-09-27.png`, `android-usda-search-2026-09-27.png`.

## Credential handling

- No credential was written to the repository, fixture contents, documentation, URLs, query keys, or screenshots. A failed first local recorder invocation echoed the owner-supplied key in terminal output before capture; the key MUST be rotated and is not used again.
- The local recorder process unset its environment value on exit. The emulator's temporary secure-storage key was removed through Food Databases → Remove key; the final screen returned to `USDA, Not set up` (`android-food-databases-key-removed-2026-09-27.png`).
