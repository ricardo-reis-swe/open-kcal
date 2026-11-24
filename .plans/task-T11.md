# Task T11: weekly live contract check for USDA + Open Food Facts (POST-08)

## User decisions needed (before or during implementation)
1. **Approve moving POST-08 into the MVP, with the spec edits below.** POST says its items "MUST NOT be built ... Each item is re-scoped and approved before work starts". TODO.md lists POST-08 under P2, not P3 ("each needs approval"), and the orchestrator assigned T11. Treat that as the request only if the user confirms. Precedent: POST-03 and POST-11 ("Moved into the MVP <date> (user request)"). **The spec edits in "Docs" need that approval. Don't write them before it.**
2. **Add the repo secret `USDA_API_KEY`** (GitHub → ricardo-reis-swe/open-kcal → Settings → Secrets → Actions). Only the user can do this. Use a dedicated data.gov key, not the one in the app on their phone. Until it's added, the workflow falls back to `DEMO_KEY`, runs a reduced USDA set and prints a warning. Nothing breaks, and local runs never need the secret.
3. **ARCH-14 wording.** It says the USDA key is "NEVER in ... build-service secrets". POST-08 itself asks for "a CI-secret USDA key". These don't really conflict: ARCH-14 protects the *app's* key and builds, and this secret is a test-only key that never enters a build or the bundle. But ARCH has higher precedence, so the plan proposes a one-line clarification (Docs §3). The user approves it, or rejects it, in which case the check runs on `DEMO_KEY` only.
4. *(Small, default chosen)* An issue opens only on **scheduled** failures, not on manual runs. Schedule: **Monday 06:17 UTC**.

## Facts checked today (2026-11-24, from this laptop)
- USDA `foods/search?query=egg` with `DEMO_KEY`: first try **HTML 400** (nginx), then 200 twice. PROV-10's intermittent 400 is still happening. `X-RateLimit-Limit: 10` for `DEMO_KEY`, so it's now **10/h, not the 30/h** PROV-02 states (flag for a later PROV-02 fact fix; not part of this task).
- OFF Search-a-licious `iogurte grego` → 200, `page 1`, `page_count 15`, 10 hits. OFF product `5601009983179` → 200, `status 1`.
- **Jest gotcha:** under the `jest-expo` preset, the global `fetch` is Expo's winter `FetchResponse` stub (`node_modules/expo/src/winter/fetch/FetchResponse.ts`). `response.json()` fails with `"undefined" is not valid JSON`, even with `--testEnvironment node`, because the preset's setupFiles replace `fetch`. So the live suite **must capture Node's real `fetch` in a custom test environment** before the setup files run (step 3). Not yet proven end to end: proving it is the first implementation step.
- Repo `ricardo-reis-swe/open-kcal` is **public** and has issues enabled. Its secrets today are only the 4 `ANDROID_*` ones.

## Design
- A separate Jest config runs one live suite that drives **the app's real clients** (`UsdaClient`, `OpenFoodFactsClient`). That way it checks the same URLs, params, `User-Agent`, timeouts, retries and Zod schemas (PROV-02/03/10/13) that the app uses. Then it runs semantic checks that Zod can't catch: most fields are `.optional()`/`.default()`, so a renamed field makes every hit **drop silently** under PROV-07 instead of failing.
- The live suite can't be picked up by `npm test`/`npm run check`, so normal CI (ROAD-05) stays offline.
- A scheduled workflow plus `workflow_dispatch` runs it. On a contract failure in a scheduled run, it opens an issue or comments on the open one. It never blocks PRs.

## Files

### 1. `src/data/api/diagnostics.ts` (tiny, no behaviour change)
- Add `export function providerFailureDetails(error: unknown): { status?: number; issuePath?: string } | undefined`, which reads the existing WeakMap. The live suite uses it to tell schema failures (with `issuePath`) from transient ones (with `status`) without parsing messages (ARCH-13).

### 2. `src/data/api/usda/mapper.ts` (tiny)
- `mapUsdaSearchFood`: throw `schemaError('USDA search schema error', parsed.error)` instead of a bare `ProviderResponseError`. That gives per-hit failures an issue path. Message and type stay the same, so existing tests pass. Check with `grep -rn "USDA search schema error" src`.

### 3. `jest.live.env.js` (new, repo root, CommonJS)
```js
// POST-08: jest-expo's setup replaces global fetch with Expo's stub; keep Node's real fetch for the live suite.
const { TestEnvironment } = require('jest-environment-node');
module.exports = class LiveEnvironment extends TestEnvironment {
  constructor(config, context) {
    super(config, context);
    this.global.liveFetch = globalThis.fetch.bind(globalThis);
  }
};
```
`jest-environment-node` is already in `node_modules` (a jest dependency). Don't add it to package.json unless `npm ls jest-environment-node` shows it isn't hoisted. If the preset's `customExportConditions`/RN setup needs the preset's own environment, extend that class instead. Use the same one-line capture either way.

### 4. `jest.live.config.js` (new)
```js
const base = require('./jest.config.js');
module.exports = {
  ...base,
  testEnvironment: '<rootDir>/jest.live.env.js',
  testMatch: ['<rootDir>/src/data/api/__live__/**/*.live.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/ios/', '/android/'],
  testTimeout: 180_000,
};
```
- Add `'/__live__/'` to the **base** `jest.config.js` `testPathIgnorePatterns`, with a comment citing POST-08. The default jest-expo `testMatch` (`__tests__/**`, `*.test|spec.*`) already skips `*.live.ts`, so this is a second guard. The live config overrides the list, so it still finds the file.
- Keep `setupFiles` (`jest.env.js` loads `.env.example` → base URLs and the OFF contact) and `setupFilesAfterEnv` from the base.

### 5. `package.json`
- `"test:live": "jest --config jest.live.config.js --runInBand"`. Don't add it to `check`.

### 6. `src/data/api/__live__/providers.live.ts` (new, the suite)
Setup:
- `const realFetch = (globalThis as { liveFetch?: typeof fetch }).liveFetch`. If it's missing, throw "run with npm run test:live".
- **Recording fetch:** `(url, init) => realFetch(url, init).then((r) => { lastBody = r.clone(); return r; })`. It keeps only the last **response body** so the raw hits can be analysed. Never record the URL or headers (ARCH-15, PROV-12).
- Config: `parseConfig(process.env, <app.json expo.version>)`, with values from `.env.example` via `jest.env.js`.
- Credentials stub: `{ getUsdaApiKeyForRequest: async () => key }`, where `key = process.env.USDA_API_KEY?.trim() || 'DEMO_KEY'`. `full = key !== 'DEMO_KEY'`. `DEMO_KEY` is fine here because PROV-11's rejection applies only to the app's UI. The key is never printed, put in assertion messages, or written to the summary.
- Silent `Logger` (`debug/info/warn/error` no-ops), passed to both clients. Otherwise the client's `logProviderFailure` prints.
- `report(line)`: append to `process.env.GITHUB_STEP_SUMMARY` when it's set (with `fs.appendFileSync`), else `process.stderr.write`. **Why:** ESLint has `no-console: error`.
- One `AbortController().signal` per call.

**Classification helper** `live(name, fn)`: runs `fn`, and on error does **one** test-level retry after 30 s, on top of the clients' own PROV-10 retries. Then:
| Outcome | Classified as | Test result |
|---|---|---|
| Assertion fails (counts, semantics below) | contract drift | **fail** |
| `ProviderResponseError` with `issuePath` (whole-response Zod fail) | contract drift | **fail**, message = provider + check + issue path (never values) |
| `ProviderResponseError` "response is invalid" (200 but not JSON) | contract drift | **fail** |
| `NotFoundError` on a pinned fixture ID | fixture ID retired (still needs a human) | **fail**, message says to re-pick the ID / re-capture (PROV-13) |
| USDA `ProviderConfigurationError` `usda_key_rejected` (401/403) | setup | **fail** with a "secret USDA_API_KEY rejected" message. With `DEMO_KEY` this means data.gov changed DEMO_KEY: same failure. |
| `TimeoutError`, `RateLimitError` (USDA 429, OFF 429/503), `ProviderResponseError` with `status` 5xx or USDA 400, or with no status and no issuePath (network) | transient | **pass**, plus `report('transient: <provider> <check> <ErrorType> <status>')` |
- An unknown error type is a **fail** (it's `UnexpectedError` territory).
- Telling "invalid JSON" apart from "network": both are a `ProviderResponseError` with no status. Use the recording fetch: if a response arrived with `ok === true`, it's invalid JSON, which counts as drift. If no response arrived, it's network, which counts as transient.

**Checks** (sequential, `--runInBand`). Fixed queries and IDs come from PROV-13's captured fixtures, so a failure can be compared against them.

USDA (`DEMO_KEY` set marked ★; the rest only when `full`):
1. ★ `search('egg', 1)`: `mapUsdaSearch` passed (no throw). Raw `foods.length ≥ 5`. Run each raw hit through `mapUsdaSearchFood` and count schema throws: **fail if > 50 %**, report the count if > 0. Candidates `≥ 5`. At least one raw hit has `dataType` in the generic set (Foundation/SR Legacy/Survey (FNDDS)), and the first candidate is generic (PROV-08 ordering). At least one candidate has a non-null `proteinG`. `page === 1`, `pageCount ≥ 2`.
2. ★ `getFood('747997')` (Foundation): non-null, `energyKcal > 0`, at least one serving beyond the `g`/`oz` basis pair (measureUnit portions).
3. `getFood('174980')` (SR Legacy): non-null, `energyKcal > 0`, at least one modifier portion.
4. `getFood('2705413')` (FNDDS): non-null, `energyKcal > 0`, at least one portion.
5. ★ `getFood('2035482')` (Branded): non-null, `energyKcal > 0`, a `serving` serving exists, `barcode` non-null (DATA-24 `gtinUpc`).
6. `findBarcode(<GTIN-14 of 031200037206>)`: no throw. A `null` result is **reported, not failed** (a delisted product is data, not contract).
Budget: 3 calls on `DEMO_KEY` (≤ 9 worst case with client retries, test retries aside), which fits 10/h for a single run. 6 calls with a real key (≤ 18 + retries), far under 1,000/h.

OFF (no key; the client's own limiters already keep within 8 searches and 12 product reads per minute, PROV-04):
7. `search('iogurte grego', 1, signal, 'pt-PT')`: raw `hits.length ≥ 5`. Per-hit `mapOpenFoodFactsProduct` schema throws **fail if > 50 %**. Candidates `≥ 3`. At least one candidate has a non-null `brand` (the `brands` array shape). At least one has a non-null macro. `pageCount ≥ 1`.
8. `getFood('5601009983179')`: non-null, `energyKcal > 0`, `externalId` matches. `findBarcode` uses the same endpoint, so it isn't called separately.

Total live calls per run: 5 with `DEMO_KEY`, 8 with a key, all sequential. The run takes about 30–60 s, plus up to 30 s for each transient retry.

**User-Agent:** OFF calls go through `OpenFoodFactsClient` unchanged, so they send exactly the PROV-01 UA (`CalorieTracker/<app.json version> (<EXPO_PUBLIC_OFF_CONTACT_EMAIL from .env.example>)`). That's already-public build config (PROV-01, ROAD-04), with no new personal data and no runner details. USDA needs no UA (Node's default). Don't invent a second identity, and don't hardcode the contact in the suite or the workflow.

### 7. `.github/workflows/live-providers.yml` (new)
```yaml
name: Live provider check

# POST-08: weekly check of the USDA + OFF contracts against the live APIs. Never runs on push/PR (ROAD-05 stays offline).
on:
  schedule:
    - cron: '17 6 * * 1' # Monday 06:17 UTC, off the hour (GitHub delays on-the-hour schedules)
  workflow_dispatch:

concurrency:
  group: live-providers
  cancel-in-progress: false

permissions:
  contents: read

jobs:
  check:
    name: USDA + Open Food Facts contracts
    if: github.repository == 'ricardo-reis-swe/open-kcal' # forks don't hit the APIs
    runs-on: ubuntu-latest
    timeout-minutes: 15
    permissions:
      contents: read
      issues: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24, cache: npm }
      - run: npm ci
      - name: USDA key
        env: { USDA_API_KEY: '${{ secrets.USDA_API_KEY }}' }
        run: |
          if [ -z "$USDA_API_KEY" ]; then
            echo "::warning::No USDA_API_KEY secret: USDA runs a reduced set on DEMO_KEY (POST-08)."
          fi
      - id: live
        run: npm run test:live
        env: { USDA_API_KEY: '${{ secrets.USDA_API_KEY }}' }
      - name: Open or update the issue
        if: failure() && steps.live.outcome == 'failure' && github.event_name == 'schedule'
        env:
          GH_TOKEN: ${{ github.token }}
          RUN_URL: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}
        run: |
          title="Live provider contract check failed"
          number=$(gh issue list --repo "$GITHUB_REPOSITORY" --state open --search "in:title \"$title\"" --json number --jq '.[0].number // empty')
          body="The weekly USDA / Open Food Facts contract check (POST-08) failed: $RUN_URL. Compare with the PROV-13 fixtures, then fix the adapter or re-capture."
          if [ -n "$number" ]; then gh issue comment "$number" --repo "$GITHUB_REPOSITORY" --body "$body"
          else gh issue create --repo "$GITHUB_REPOSITORY" --title "$title" --body "$body"; fi
```
- The issue body holds only the run link. **Why:** the repo is public. The failing provider and issue path are in the run log and the step summary. They never include the key, and GitHub masks secrets in logs as well.
- One open issue at a time: later failures add comments. The user closes it when it's fixed.
- `npm ci` or setup failures don't open an issue (`steps.live.outcome` guard). They show as a red run.
- Pin the action versions like `ci.yml` (`@v4`).

## Edge cases
- **Intermittent USDA HTML 400** (seen again today): the client retries it twice, and the test adds one 30 s retry. If it still fails, it counts as transient.
- **`DEMO_KEY` 10/h shared per IP:** GitHub runners share IPs, so a 429 is likely. It counts as transient, never as failure.
- **USDA re-release retires an fdcId** (FNDDS IDs change between releases): reported as "fixture ID retired". It fails on purpose so the fixtures get refreshed.
- **Results drift** (ranking, totals): never asserted exactly. Only minimums and shape are checked, so normal data churn doesn't fail.
- **Silent PROV-07 drops from a renamed field:** caught by the candidate minimums and the per-hit schema ratio.
- **Search-a-licious 0.1.0 changes `hits`/`page_count`:** whole-response Zod fails, which counts as drift.
- **OFF 503 as global rate limit** (PROV-03): transient.
- **Scheduled workflows stop after 60 days without repo activity** (GitHub rule for public repos). Note it in progress.md: re-enable from the Actions tab if that happens.
- **Transient every week:** no issue is ever opened. Accepted. The step summary shows the warnings, and the user can run it by hand.
- **Timeouts:** client timeouts are 8 s for search and 10 s for detail (PROV-10). Jest `testTimeout` is 180 s per test. The job's `timeout-minutes` is 15.
- **Local runs without network:** everything is transient, so the run passes with warnings. That's intended: it can't break local work.

## Docs (only after decision 1, and the ARCH-14 line only after decision 3)
1. `docs/post-mvp.md` POST-08: add "Moved into the MVP 2026-11-24 (user request): `.github/workflows/live-providers.yml`, `npm run test:live`. ID kept so it is not reused." Keep the existing bullets. Drop "Deferred: during the MVP ..." or reword it to past tense.
2. `docs/07-providers.md` PROV-13 last line → "No live API calls in `npm test`. The weekly live contract check (POST-08, ROAD-05) runs separately via `npm run test:live`."
3. `docs/04-architecture.md`: in ARCH-18, change the API contract row's "(scheduled live check: POST-08)" to "(weekly live check: ROAD-05, `npm run test:live`)". In ARCH-14, add "A test-only USDA key MAY be a CI secret for the POST-08 live check; it never enters a build." **Needs decision 3.**
4. `docs/08-roadmap.md` ROAD-05: add a bullet: "Weekly live provider check: `.github/workflows/live-providers.yml` (schedule + manual), `npm run test:live`, secret `USDA_API_KEY` (falls back to `DEMO_KEY`). Never on push/PR; a scheduled failure opens or updates one issue (POST-08)."
5. `docs/progress.md`: add a one-line dated entry (POST-08 live check, files, evidence = the local `npm run test:live` result). Include the known gaps: secret not set yet; DEMO_KEY is now 10/h, not PROV-02's 30/h; the 60-day schedule pause.
6. `PROGRESS.md` T11 row → DONE with a one-line note. (This file already has an uncommitted change; leave it as it is.)
No renumbering; new text cites POST-08.

## Verify
```bash
cd /home/reis/Desktop/open-kcal
npx jest --listTests | grep -c __live__        # → 0 (normal suite never sees it)
npx jest --config jest.live.config.js --listTests   # → only src/data/api/__live__/providers.live.ts
npm run format:check && npm run check          # green, offline, same suite count as before (+0)
npm run test:live                              # live, DEMO_KEY reduced set; expect pass (transient warnings allowed)
```
- Optional full set: the user runs `USDA_API_KEY=... npm run test:live` in their own shell. The key never goes through chat.
- Prove a failure: temporarily change the OFF search check's `hits` minimum to `≥ 100` (or point `EXPO_PUBLIC_OFF_SEARCH_BASE_URL` at `https://world.openfoodfacts.org`, which returns a different shape), run it, expect a red run with a readable message, then revert.
- `actionlint .github/workflows/live-providers.yml` if it's installed (optional).
- After pushing: Actions → **Live provider check** → Run workflow. Expect it green with the `DEMO_KEY` warning until the secret is added. The issue step is skipped on manual runs.
- Grep the run log and step summary for the key: there should be no occurrences. GitHub masks secrets as well.

## Commit (when told to)
- One commit: `task T11: weekly live provider contract check (POST-08)`, with the AGENTS.md commit identity and no co-author lines.
