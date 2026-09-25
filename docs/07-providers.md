# 07 Food providers (PROV)

Status: **DRAFT, written one step at a time.** Steps 1–2 approved.

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
| Search | `GET /foods/search?query=&dataType=Foundation,SR Legacy,Survey (FNDDS),Branded&pageSize=20&pageNumber=` | Leave out `Experimental`. Nutrients in the results are per 100 g; there are no portions. |
| Select a result | `GET /food/{fdcId}?format=full` | Called on tap before upsert (UX-04), because portions only come from here. |
| Refresh cached | Same as select | Rules come in the cache step. |
- Search fields used: `fdcId, description, dataType, brandOwner, brandName, servingSize, servingSizeUnit, householdServingFullText, foodNutrients[].{nutrientNumber, unitName, value}`, plus `totalHits, currentPage, totalPages` for paging.
- Detail fields used: the same, plus `foodPortions[].{amount, gramWeight, modifier, portionDescription, measureUnit.name}` and `labelNutrients` (Branded).
- Limit: 1,000 requests/hour (the FDC guide counts per IP; `DEMO_KEY` gets only 30/h and must never ship). Over the limit → HTTP 429 with `X-RateLimit-Limit` / `X-RateLimit-Remaining` headers.

## PROV-03 OFF endpoints
| Use | Call | Notes |
|---|---|---|
| Search | `GET /search?q=&langs=<lang>,en&page_size=20&page=&fields=code,product_name,brands,nutriments` (search host) | Search-a-licious. Response has `hits[]`, `count`, `page`, `page_count`, `is_count_exact`. `brands` is an array. `nutriments` holds only `*_100g` values. |
| Select a result | `GET /api/v2/product/{code}?fields=code,product_name,brands,quantity,product_quantity,serving_size,serving_quantity,nutrition_data_per,nutriments` (product host) | Called on tap before upsert. It's the only source of serving data. `status: 1` means found. `brands` is a comma-separated string here. |
| Refresh cached | Same as select | Rules come in the cache step. |
- Use Search-a-licious for full-text search, as the OFF docs recommend. They mark `/cgi/search.pl` as legacy, and `/api/v2/search` only filters (no full-text search).
- Limits per IP: **10 searches/min**, **15 product reads/min**. Going over repeatedly can get the IP banned. OFF also has global rate limits that answer **HTTP 503**: treat 503 as rate-limited and back off, not as "service down".
- Search-a-licious is at version 0.1.0 (young). Keep it fully behind the OFF adapter so a switch touches one module.

## PROV-04 Request budget
**Why:** at the UX-04 debounce, typing a query can fire several OFF searches, and 10/min runs out fast.
- Each OFF endpoint gets its own client-side limiter, with a margin: **8 searches/min, 12 product reads/min**. USDA gets none (the 1,000/h budget is enough).
- When the search budget is spent: run only the **latest** pending query once a slot frees up, and drop the rest. The OFF section shows its loading row meanwhile.
- OFF search starts at **≥3 characters after 800 ms idle** (USDA keeps UX-04's ≥2 characters and 400 ms).
- TanStack Query caches each `(provider, query, page)` for 10 min, so backspacing or retyping doesn't spend budget.
- If a product read is throttled, the tapped row keeps its spinner until a slot frees (at most ~5 s), then shows the UX-04 row error.

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
| `carbohydrate_g` | `205` (by difference) → `205.2` (by summation) | g |
- Values are per 100 g for every data type (for Branded, per 100 g or 100 ml, see PROV-06). Checked: Branded `208 = 467` per 100 g matches label calories of 140 per 30 g serving.
- Branded fallback: if `foodNutrients` has no energy but `labelNutrients.calories` and `servingSize` exist, then `per100 = label value ÷ servingSize × 100`. Macros use the same fallback from `labelNutrients.{protein, fat, carbohydrates}`.

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

<!-- Steps 3–9 pending: servings · drop rules · ranking/paging/language · cache TTL + refresh · timeouts/retries · USDA key validation · error mapping + fixtures -->
