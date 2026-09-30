# 07 Food providers (PROV)

Read when: working in `src/data/api/**`, the food search flow, or cache refresh. Provider-agnostic rules live in ARCH-11 (interface, HTTP wrapper), DATA-15 (upsert, dedupe) and UX-04 (search screen). This doc covers what is specific to each provider.

Facts below were checked against the live APIs on 2026-09-25. Re-check against the official docs at implementation start: [USDA FDC API guide](https://fdc.nal.usda.gov/api-guide/) · [OFF API](https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/) · [Search-a-licious](https://search.openfoodfacts.org/docs).

## PROV-01 Hosts and identification
| Provider | Base URL (public env, ARCH-14) | Auth / identification |
|---|---|---|
| USDA FDC | `https://api.nal.usda.gov/fdc/v1` | User key in the **`X-Api-Key` header** only |
| OFF search | `https://search.openfoodfacts.org` | `User-Agent: CalorieTracker/<appVersion> (<contact email>)` |
| OFF product | `https://world.openfoodfacts.org` | Same `User-Agent` |
- The USDA key MUST NOT go in the URL (`api_key=` query param). URLs end up in logs and error reports (ARCH-10, ARCH-15).
- The OFF contact email is public build config, not user data. Verify on device that RN really sends the custom `User-Agent` on both platforms.
- OFF staging (`world.openfoodfacts.net`, basic auth `off:off`) is only for manual dev checks. Tests use fixtures (fixtures step).

## PROV-02 USDA endpoints
| Use | Call | Notes |
|---|---|---|
| Search | `GET /foods/search?query=&dataType=Foundation,SR Legacy,Survey (FNDDS),Branded&pageSize=10&pageNumber=` | Leave out `Experimental`. Nutrients in the results are per 100 g; there are no portions. |
| Select a result | `GET /food/{fdcId}?format=full` | Called on tap before upsert (UX-04), because portions only come from here. |
| Refresh cached | Same as select | Rules come in the cache step. |
- Search fields used: `fdcId, description, dataType, brandOwner, brandName, servingSize, servingSizeUnit, householdServingFullText, foodNutrients[].{nutrientNumber, unitName, value}`, plus `totalHits, currentPage, totalPages` for paging.
- Detail fields used: the same, plus `foodPortions[].{amount, gramWeight, modifier, portionDescription, measureUnit.name}` and `labelNutrients` (Branded).
- Limit: 1,000 requests/hour (the FDC guide counts per IP; `DEMO_KEY` gets only 30/h and must never ship). Over the limit → HTTP 429 with `X-RateLimit-Limit` / `X-RateLimit-Remaining` headers.

## PROV-03 OFF endpoints
| Use | Call | Notes |
|---|---|---|
| Search | `GET /search?q=<terms>&langs=<appLang>,en&page_size=10&page=&fields=code,product_name,brands,nutriments` (search host) | Search-a-licious. Response has `hits[]`, `count`, `page`, `page_count`, `is_count_exact`. `brands` is an array. `nutriments` holds only `*_100g` values. |
| Select a result | `GET /api/v2/product/{code}?fields=code,product_name,brands,quantity,product_quantity,serving_size,serving_quantity,nutrition_data_per,nutriments` (product host) | Called on tap before upsert. It's the only source of serving data. `status: 1` means found. `brands` is a comma-separated string here. |
| Refresh cached | Same as select | Rules come in the cache step. |
- Use Search-a-licious for full-text search, as the OFF docs recommend. They mark `/cgi/search.pl` as legacy, and `/api/v2/search` only filters (no full-text search).
- Limits per IP: **10 searches/min**, **15 product reads/min**. Going over repeatedly can get the IP banned. OFF also has global rate limits that answer **HTTP 503**: treat 503 as rate-limited and back off, not as "service down".
- No region/country filter in the MVP (POST-01). Portuguese queries may also return Brazilian products; that's accepted.
- `langs=<appLang>,en` (pt-PT → `pt,en`). OFF names come back in that language when available. USDA is English-only: Portuguese terms return 0 USDA hits (checked: `bacalhau`), so the USDA section usually shows `No results` for Portuguese queries.
- Search-a-licious is at version 0.1.0 (young). Keep it fully behind the OFF adapter so a switch touches one module.

## PROV-04 Request budget
**Why:** at the UX-04 debounce, typing a query can fire several OFF searches, and 10/min runs out fast.
- Each OFF endpoint gets its own client-side limiter, with a margin: **8 searches/min, 12 product reads/min**. USDA gets none (the 1,000/h budget is enough).
- When the search budget is spent: run only the **latest** pending query once a slot frees up, and drop the rest. The OFF section shows its loading row meanwhile.
- OFF search starts at **≥3 characters after 800 ms idle** (USDA keeps UX-04's ≥2 characters, also after 800 ms).
- TanStack Query caches each `(provider, query, page)` for 10 min, so backspacing or retyping doesn't spend budget.
- If a product read is throttled, Food Detail waits for a slot for at most ~5 s, then shows its unavailable state.

## PROV-05 Nutrient mapping
Output per food: `energy_kcal` (required) and `protein_g`, `carbohydrate_g`, `fat_g` (each nullable, DATA-06), all per the food's basis (PROV-06). A missing or invalid value → `null`, never 0. A present 0 stays 0.

**USDA.** Nutrients are keyed by `number` (a string). The shape differs by call, so the adapter reads both:
- Search: `foodNutrients[] = { nutrientNumber, unitName: "KCAL" | "G" | "kJ", value }`.
- Detail (`format=full`): `foodNutrients[] = { nutrient: { number, unitName: "kcal" | "g" | "kJ" }, amount }`. Items without `amount` are group headers; skip them.
- Compare units case-insensitively. A unit mismatch (e.g. mg where g is expected) → treat that nutrient as missing.

| Field | Take the first present | Unit |
|---|---|---|
| `energy_kcal` | `208` → `958` (Atwater specific) → `957` (Atwater general) → `268` ÷ 4.184 | kcal (kJ for 268) |
| `protein_g` | `203` | g |
| `fat_g` | `204` (total lipid) | g |
| `carbohydrate_g` | `205` − `291` (fibre) when both exist → `205` → `205.2` (by summation); clamp ≥ 0 | g |
- Values are per 100 g for every data type (for Branded, per 100 g or 100 ml, see PROV-06). Checked: Branded `208 = 467` per 100 g matches label calories of 140 per 30 g serving.
- Branded fallback: if `foodNutrients` has no energy but `labelNutrients.calories` and `servingSize` exist, then `per100 = label value ÷ servingSize × 100`. Macros use the same fallback from `labelNutrients.{protein, fat, carbohydrates}`; carbs subtract `labelNutrients.fiber` when present.

**OFF.** Read from `nutriments`, as-sold values only (ignore `*_prepared_*`).

| Field | Take the first present |
|---|---|
| `energy_kcal` | `energy-kcal_100g` → `energy-kj_100g` ÷ 4.184 → `energy_100g` ÷ 4.184 (OFF's `energy_100g` is kJ) |
| `protein_g` | `proteins_100g` |
| `carbohydrate_g` | `carbohydrates_100g` |
| `fat_g` | `fat_100g` |
- If a `*_100g` value is missing but `*_serving` and a numeric `serving_quantity` exist: `per100 = serving ÷ serving_quantity × 100`.
- Values arrive as numbers or numeric strings. Anything non-numeric → missing.

**Sanity bounds (both providers, per 100 g/ml).**
- Invalid → `null`: a negative value; a macro > 100 g.
- Energy > 900 kcal or negative → energy invalid. That food fails the minimum-data check (drop rules step).
- Keep full precision (DATA-04). No rounding and no Atwater "correction" of provider values.

**Carbohydrate convention: EU "available carbs" (fibre excluded).** **Why:** the main market is Portugal (SCOPE-12). EU labels exclude fibre, while USDA's `205` includes it. Mixing the two would make diaries inconsistent. So USDA carbs subtract fibre (table above). OFF values are used as-is (EU products already follow the convention). Custom foods are entered from EU labels (UX-08).

## PROV-06 Basis and servings
Output: `foods.basis_quantity/basis_unit` + `food_servings` rows (DATA-11), all written at upsert. For each serving, `quantity` = grams (or ml) in **one** unit, `unit` = `g` | `ml`, and `basis_multiplier = quantity ÷ basis_quantity`. Example: basis 100 g, egg 50 g → multiplier 0.5.

**Basis**
| Source | Basis |
|---|---|
| USDA Foundation, SR Legacy, Survey (FNDDS) | 100 g |
| USDA Branded | 100 g if `servingSizeUnit` ∈ {g, GRM}; 100 ml if ∈ {ml, MLT}; anything else → 100 g and no household serving |
| OFF | 100 ml if `serving_size` or `quantity` has a volume unit (ml, cl, dl, l, fl oz) and no mass unit; otherwise 100 g |

**Always-present rows:** the basis pair. g basis → `g` (1 g) and `oz` (28.349523125 g). ml basis → `ml` (1 ml) and `fl oz` (29.5735295625 ml). This is where UX-05's g/oz and ml/fl oz tabs come from.

**USDA portions** (`foodPortions[]`, detail call). There are three shapes, all checked live:
| Shape (data type) | Label | Amount |
|---|---|---|
| `measureUnit.name` ≠ `undetermined` (Foundation) | `measureUnit.name`, plus `, <modifier>` if the modifier is non-numeric text | `amount` |
| `portionDescription` present (FNDDS), e.g. `1 cup` | text after the leading number (`cup`) | leading number |
| otherwise (SR Legacy), e.g. modifier `cracker` | `modifier` | `amount` |
- Grams per one unit = `gramWeight ÷ amount` (missing amount → 1).
- Skip a portion when: gramWeight ≤ 0; there's no usable label; the label is purely numeric; FNDDS `Quantity not specified` or `Guideline amount…`; or the label is a mass unit already covered (g, oz, lb, kg).
- Volume labels (`cup`, `fl oz`, `tbsp`) stay on g-basis foods: they are real volume→mass conversions from USDA.
- Dedupe by label (case-insensitive, first wins). Keep at most 6 portions.

**USDA Branded:** add `serving` = `servingSize` g/ml, which is the **default**, with the hint `householdServingFullText` (e.g. `2 Tbsp`). If the household text parses as `<number> <label>`, also add that label per unit (`Tbsp` = 15 g).

**OFF:**
- If `serving_quantity` is numeric and > 0, add `serving` = `serving_quantity` g/ml as the **default**. `serving_quantity` is authoritative for the amount; `serving_size` text is only a label hint.
- If `serving_size` parses as `<n> <label> (<x> g|ml)` (e.g. `2 biscuits (25 g)`), also add `<label>` = x ÷ n per unit.

**Default serving** (`is_default = 1`, exactly one): Branded/OFF `serving` if present → otherwise the first USDA portion → otherwise `g`/`ml`.
**Order** (`sort_order`): default, other portions in provider order, then the basis pair (UX-05 shows the preferred unit of the pair first).

**Labels:** stored as given, singular where possible, lowercase unless it's an abbreviation (`Tbsp`). No automatic pluralization (labels may be English or Portuguese). Display: count labels as `<qty> × <label>` (`2 × egg`, `1,5 × fatia`), mass/volume units as `<qty> <unit>` (`150 g`, `2 oz`). Screen reader: `2, egg`.

## PROV-07 Minimum data and normalization
Applied in `mapToCandidate` (ARCH-11) to search hits and again to detail responses. A dropped item is silently left out; count drops in dev logs only.

**Drop when any of these holds:**
- No external ID (`fdcId` / `code` missing or empty).
- No name after normalization (below).
- Energy missing or invalid (PROV-05).
- Energy is 0 while no macro is known. **Why:** that pattern means an unfilled record, not a zero-calorie food.
- Energy is 0 while known macros add up to ≥ 20 kcal (4/4/9 per g). The energy value is clearly missing.

**Keep:** foods with some or all macros unknown (they show `—`, DATA-06); true zero foods (energy 0 with macros known and ≈ 0, e.g. water).

**Detail responses:** if the detail fails the rules above, don't upsert; Food Detail shows its unavailable state. Where search and detail disagree, the detail wins.

**Normalization:**
| Field | Rule |
|---|---|
| Name | USDA `description`; OFF `product_name`. Trim and collapse whitespace; cap at 200 chars. If the name has letters and they're all uppercase (common in USDA Branded, e.g. `GREEK YOGURT`), convert to sentence case (`Greek yogurt`) per DS-04. |
| Brand | USDA `brandName` → `brandOwner`; OFF first entry of `brands` (array in search, comma-separated string in detail). Trim; all-caps → title case. Empty → `null`. |
| External ID | USDA `fdcId` as a string; OFF `code` exactly as returned (no padding or trimming of leading zeros). |

## PROV-08 Matching, ranking and paging
Section order and debounce: UX-04, PROV-04. Language: PROV-03.

**Local sections (`My foods` = active custom foods, `Saved` = cached external foods)**
- Match with SQLite `LIKE '%token%'` on `name` and `brand`. A food matches if every query token (trimmed, whitespace-split) is in its name or brand.
- No normalized search column (product decision). Accepted limits: case-insensitivity is ASCII-only, and accents must match as typed (`pao` doesn't find `Pão`).
- Rank: name equals the query → name starts with the query → every token starts a word → any other match. Ties: `recent_foods.use_count` desc → `last_used_at` desc → shorter name.
- 20 per section, plus `Show more` for the next 20.

**Remote sections (`Open Food Facts`, `USDA`)**
- Keep the provider's relevance order; send no `sort_by`/`sortBy`.
- USDA: within each page, stably move Foundation / SR Legacy / Survey (FNDDS) above Branded. **Why:** for generic terms (`egg`, `rice`), branded products otherwise bury the generic reference foods.
- Hide any remote hit whose `(source, external_id)` already appears in `Saved` (DATA-15 dedupe). The local copy shows instead.
- Query sent as typed: trimmed and whitespace collapsed, diacritics kept.
- Page size 10 per section. **Why:** 10 per source is enough, and response time doesn't depend on it (measured 2026-09-28: OFF search ~0.18 s at 5, 10 and 20). `Show more` fetches the next page and appends it. The row disappears when the last page is reached (USDA `currentPage ≥ totalPages`, OFF `page ≥ page_count`) or after **5 pages** (50 results) per section per query. Each OFF page spends search budget (PROV-04).
- Drops (PROV-07) can make a page shorter than 10. Never auto-fetch to refill it.
- Ignore responses for a query that is no longer current (belt and braces on top of `AbortController`).

**Empty sections:** an empty local section is hidden. An empty remote section that was searched shows one compact `No results` row, so the user knows it was checked. UX-04's "Nothing anywhere" state still applies when every section is empty.

## PROV-09 Cache freshness and refresh
Rules for `food_cache_metadata` (DATA-15). Expiry controls refresh only. Expired foods stay searchable and loggable, online or offline.

**What gets cached:** only foods the user **selects** (the tap → detail → upsert in UX-04). Search hits that aren't tapped are never written to SQLite. So `Saved` = external foods the user has opened.

**TTL:** `expires_at = fetched_at + TTL`. OFF: **30 days** (community data changes often). USDA: **90 days** (published releases). No eviction in the MVP.

**Parser version:** each adapter has a `PARSER_VERSION` constant, stored in `schema_version`. A row with an older version counts as expired, so a mapping fix (PROV-05/06/07) reaches cached foods the next time each is opened.

**When a refresh runs:** only when an expired (or old-parser) food is opened from Search or Recent while online. It runs in the background and never changes an open screen (UX-04). No refresh on app start, no bulk refresh, no background jobs (ARCH-12).

**How a refresh writes** (one transaction):
- Detail call (PROV-02/03) → PROV-05/06/07 → update the existing `foods` row in place. The local `id` never changes; match on `(source, external_id)`.
- Servings: match existing rows by `(label, unit)`, case-insensitive. Update matches in place, insert new ones, delete missing ones. Deleting sets `recent_foods.last_serving_id` to NULL, which is acceptable.
- Metadata: new `fetched_at`, `expires_at` and `schema_version`.
- Diary snapshots are never touched (DATA-05).

**Refresh outcomes:**
| Result | Action |
|---|---|
| Success | Write as above |
| Not found (USDA 404, OFF `status: 0`) | Keep the cached food as-is and push `expires_at` out by one TTL, so it isn't retried on every open |
| Fails PROV-07 | Keep the cached food; push `expires_at` out by one TTL |
| Network/HTTP error, rate-limited | Keep the cached food; change nothing, so the next open retries |
- All refresh failures are silent to the user (dev log only).

**`raw_payload_json`:** store only the fields the adapter reads (PROV-02/03 field lists), as JSON, never headers or keys. Skip storing it (NULL) if it's over 64 KB.

**Stale indicator:** none per row. Membership in the `Saved` section is the cache indicator (ARCH-12).

## PROV-10 Timeouts, retries and cooldowns
Values for the shared HTTP wrapper (ARCH-11). Error types and user text come in the error-mapping step.

**Debounce** (defined in UX-04 and PROV-04; don't redefine): local 150 ms · USDA ≥2 chars after 800 ms · OFF ≥3 chars after 800 ms. A request is only sent once the debounce settles.

**Timeouts** (whole request, via `AbortController`): search **8 s** · detail **10 s** · USDA key check **10 s**.

**Retries**
| Call | Max retries | Backoff |
|---|---|---|
| Search | 1 | full jitter, base 500 ms |
| Detail on tap | 2 | full jitter, base 500 ms × 2ⁿ, cap 4 s |
| Background refresh (PROV-09) | 0 | the next open retries |
| USDA key check | 0 | the user retries |
- Retry only transient failures: network error while online, timeout, and HTTP 500/502/504. Also USDA 503 and USDA 400.
- Never retry: 400 (except USDA), 401, 403, 404, schema/parse failures, offline, or anything rate-limited (below).
- **Why USDA 400:** USDA's nginx front intermittently answers a valid search with a bare HTML 400; the same URL alternates 200/400 (seen 2026-09-30, user decision). A real bad-parameter 400 fails the retry too and still surfaces.
- Each OFF retry spends a budget slot (PROV-04).

**Rate-limited responses → provider cooldown**
- OFF 429 or 503 (PROV-03), USDA 429.
- Cooldown = `Retry-After` (seconds or HTTP date) if present, otherwise **60 s** for OFF and **10 min** for USDA.
- During a cooldown, that provider sends nothing. Its section shows the busy status, and search and product-read budgets are both paused for OFF. Once the cooldown ends, the latest pending query runs (PROV-04).

**Offline:** don't send remote requests while connectivity reports offline. They resume through `onlineManager` (ARCH-12).

**Cancellation:** a new query aborts the previous one's requests (ARCH-11). Leaving Food Search aborts its in-flight searches. Leaving Food Detail while a selected remote food loads aborts that detail call; nothing is upserted.

## PROV-11 USDA key check
Implements UX-18 (Food Databases). Only `CredentialsService` touches the key (ARCH-10).

**Local checks before anything is sent:** trim; must be non-empty with no internal whitespace; `DEMO_KEY` is rejected (`Use your own key; DEMO_KEY is limited to 30 requests per hour.`). No length or format check beyond that.

**Test request** (when online): `GET /foods/search?query=apple&pageSize=1` with `X-Api-Key`. Timeout and no retries per PROV-10.
| Result | Save key? | Status shown |
|---|---|---|
| 200 | Yes | `Active` |
| 401 / 403 | **No** | Inline error `USDA rejected this key.` |
| 429 | Yes (the key is recognized, just over its limit) | `Active` |
| Offline, timeout, network or 5xx | Yes | `Saved · will check when online` |

**Status is session-only (no DB column).** On launch, a stored key shows `Saved · will check when online`. It becomes `Active` after any successful USDA request, or `Key rejected` after any 401/403.
**`Test key` button** (Food Databases, shown when a key is stored): runs the same test request on demand and updates the session status.
| Result | Status / inline message |
|---|---|
| 200 | `Active` · `Key works.` |
| 401 / 403 | `Key rejected` · `USDA rejected this key.` (the key is kept) |
| 429 | `Active` · `Key works, but it's over its hourly limit right now.` |
| Timeout, network or 5xx | status unchanged · `Couldn't reach USDA. Try again.` |
- Disabled while offline (helper `Connect to the internet to test.`) and while a test is running (inline spinner).
- On a 401/403 during search, the USDA section shows `USDA rejected your key.` + a link to Food Databases. The key is **never** deleted automatically.
- Replace: the old key stays until the new one passes the flow above. Remove: UX-19 dialog → delete from secure storage. Cached USDA foods and history stay (DATA-15).
- Signup link: `https://api.data.gov/signup/`, opened in the system browser.
- Never log the key or the test request's URL/headers; redact per ARCH-15.

## PROV-12 Error mapping
Every failure (after PROV-10 retries) becomes an ARCH-13 typed error before it leaves the adapter. Error payload: `provider`, `endpoint` (`search` | `detail` | `keyCheck`), optional `status` and `retryAfterMs`. **Never** the URL, query terms, headers, key or response body (ARCH-15).

| Condition | Error | User sees (UX-04 / UX-18) |
|---|---|---|
| Aborted (new query, left screen) | none; ignore silently | nothing |
| Connectivity offline | `OfflineError` | `Offline. Showing saved foods only.` |
| Timeout | `TimeoutError` | `<Provider> search failed.` + `Retry` |
| Network error while online, 5xx, 400 | `ProviderResponseError` | `<Provider> search failed.` + `Retry` |
| 429, OFF 503 | `RateLimitError` (+ cooldown, PROV-10) | `<Provider> is busy. Try again later.` |
| No USDA key | `ProviderConfigurationError` (`usda_key_missing`) | `Add a USDA API key to search USDA` → Food Databases |
| USDA 401/403 | `ProviderConfigurationError` (`usda_key_rejected`) | `USDA rejected your key.` → Food Databases |
| Whole response fails its Zod schema | `ProviderResponseError` (`schema`) | `<Provider> search failed.` + `Retry` |
| Single hit fails PROV-07 | not an error; dropped | nothing |
| Detail 404 / OFF `status: 0` | `NotFoundError` | Food Detail unavailable state |
| Detail fails PROV-07 | `ProviderResponseError` (`insufficient_data`) | Food Detail unavailable state |
| Anything else | `UnexpectedError` | `<Provider> search failed.` + `Retry` |
- The UX-04 status texts generalize to `<Provider>` (`Open Food Facts` / `USDA`). One provider failing never hides the other sections (ARCH-12).
- Dev builds log provider, endpoint, status and Zod issue path. Release builds log only the error type and provider.

## PROV-13 Fixtures and contract tests
Implements ARCH-18's API contract tests. Fixtures live in `src/data/api/{usda,open-food-facts}/__fixtures__/`.
- **Captured** fixtures are real responses, trimmed to the fields the adapter reads (PROV-02/03), with no headers or keys. A dev-only script records them using a key from the developer's local env, never committed. **Synthetic** fixtures (hand-written edge cases) are prefixed `synthetic-`.
- Each fixture has an explicitly written expected mapper output (candidate, servings, or error). No auto-generated snapshots (ARCH-18).

**Required fixtures**
| Provider | Fixture | Covers |
|---|---|---|
| USDA | search `egg` (mixed data types) | PROV-05 search shape, PROV-08 generic-before-Branded |
| USDA | detail Foundation `747997` | `measureUnit` portions, detail nutrient shape |
| USDA | detail SR Legacy `174980` | modifier portions, skipped `oz` |
| USDA | detail FNDDS `2705413` | `portionDescription`, filler rows skipped |
| USDA | detail Branded `2035482` | all-caps name, `serving` + household `Tbsp`, fibre subtraction |
| USDA | synthetic: no `208`, has `958`/`957`; kJ-only; 401; 429 with `Retry-After` | energy fallbacks, key rejected, cooldown |
| OFF | search `iogurte grego` | `brands` array, `*_100g` nutriments |
| OFF | product `0894700010137` | `serving_quantity`, `nutrition_data_per: serving`, comma-string `brands` |
| OFF | captured liquid product (ml) | 100 ml basis, ml/fl oz pair |
| OFF | synthetic: kJ-only; numeric strings; 0 kcal and no macros; `status: 0`; 503 HTML body; 429 | fallbacks, drop rule, not found, rate limit |

No live API calls in tests during the MVP. A scheduled live contract check is post-MVP (POST-08).
