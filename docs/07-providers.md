# 07 Food providers (PROV)

Status: **DRAFT, written one step at a time.** Steps 1–3 approved. Step 4 ready for review.

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
| Search | `GET /search?q=<terms>&langs=<appLang>,en&page_size=20&page=&fields=code,product_name,brands,nutriments` (search host) | Search-a-licious. Response has `hits[]`, `count`, `page`, `page_count`, `is_count_exact`. `brands` is an array. `nutriments` holds only `*_100g` values. |
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

**Detail responses:** if the detail fails the rules above, don't upsert; show the UX-04 row error `Couldn't load this food.` Where search and detail disagree, the detail wins.

**Normalization:**
| Field | Rule |
|---|---|
| Name | USDA `description`; OFF `product_name`. Trim and collapse whitespace; cap at 200 chars. If the name has letters and they're all uppercase (common in USDA Branded, e.g. `GREEK YOGURT`), convert to sentence case (`Greek yogurt`) per DS-04. |
| Brand | USDA `brandName` → `brandOwner`; OFF first entry of `brands` (array in search, comma-separated string in detail). Trim; all-caps → title case. Empty → `null`. |
| External ID | USDA `fdcId` as a string; OFF `code` exactly as returned (no padding or trimming of leading zeros). |

<!-- Steps 5–9 pending: ranking/paging/language · cache TTL + refresh · timeouts/retries · USDA key validation · error mapping + fixtures -->
