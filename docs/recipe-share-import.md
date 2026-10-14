# Recipe sharing & import (promote POST-16 into the MVP)

## Context & findings

- `docs/post-mvp.md` (uncommitted) already contains **POST-16 "Recipe text sharing and import"** (dated 2026-10-10) sketching exactly this feature: `--- OPEN-KCAL-RECIPE v1 ---` text envelope + JSON payload, per-recipe `Copy` / `Share`, `Import recipe` on My recipes, clipboard read with paste fallback, preview-then-confirm. It is marked "Deferred — needs re-scoping"; this feature request **is** the re-scoping approval, so we promote it into the MVP specs (same pattern as POST-14 → SCOPE-13).
- Docs for the implemented recipe feature are **up to date** (SCOPE-13, NAV-02/04/06/08, DATA-17/25/27/28, UX-04/05/15/19/26/27 all match the code). Only drift: ARCH-05's structure block is missing `src/features/{recipes,widget}` and the recipe route lines — fix opportunistically.
- **No schema change needed.** On import, every ingredient becomes a local custom "snapshot" food (source `custom`, kind `food`, sender's name/basis/kcal/servings — no marker, per user decision). `recomputeRecipe` (DATA-28) builds the recipe's servings and raw weight, then the sender's meal-level nutrition is stored on the recipe. No name-only food matching (POST-16).
- Tech: `expo-clipboard` already installed/used; **React Native core `Share.share({ message })`** for the OS share sheet (no new dependency, no dev-build rebuild — `expo-sharing` is for files, not text).

## User decisions

- Copy/Share live on the **Edit Recipe screen** (share icon → bottom sheet), not on list rows.
- Imported ingredient foods get **no marker**.
- **v1 is snapshot-only**: no linking of imported ingredients to existing local foods (POST-16's "explicit choice before linking" clause is reworded into a deferred candidate — see step 1).

## POST-16 compliance check (uncommitted text vs this plan)

Verified line by line; all covered: envelope + `v1` marker, exact action labels (`Copy recipe text` / `Share recipe` / `Import recipe` incl. empty list), clipboard-read-after-tap + paste fallback, servings + cooked/raw weights + ingredient quantities + serving definitions + nutrition basis + item kcal, unknowns preserved (DATA-06), validation → preview → confirm, unsupported-version/malformed/oversized failures with no local writes, sender-provided/unverified labeling, duplicate imports = plain copies, no account/backend/cloud/social.
One gap found and resolved: POST-16's **"explicit choice before linking to an existing food"** → per user decision, deferred (see User decisions + step 1). Its "may require a schema change" caveat is moot: snapshot foods reuse the existing `foods` table.

## The recipe text format (v1) — to be spec'd as DATA-29

Entire message is only the versioned envelope (POST-16; no human-readable section):

```
--- OPEN-KCAL-RECIPE v1 ---
{"version":1,"name":"Bolonhesa","servingsCount":4,"cookedServingG":350,
 "rawServingGOverride":null,
 "ingredients":[{"name":"Carne de vaca picada","brand":null,
   "basisQuantity":100,"basisUnit":"g",
   "nutrients":{"energyKcal":187},
   "servings":[{"label":"g","quantity":1,"unit":"g","basisMultiplier":1,"isDefault":true}],
   "quantity":500}],
 "nutrition":{"perServing":{"energyKcal":450,"carbohydrateG":30,"proteinG":25,"fatG":18},
              "total":{"energyKcal":1800,"carbohydrateG":120,"proteinG":100,"fatG":72}}}
--- END OPEN-KCAL-RECIPE ---
```

Rules:
- JSON numbers, dot decimals (locale-independent), rounded to 2 dp. Unknown nutrients omitted/`null`, never `0` (DATA-06).
- Items carry kcal only (name/brand/basis/serving/quantity keep each item rebuildable); the meal-level `nutrition` block carries all known nutrients and is stored as-is on the recipe at import (preview labels it "sent by the other phone, unverified"). Macros cannot be recomputed from kcal-only items, so editing an imported recipe later makes its macros unknown.
- Ingredient `servings` carries only the serving used; `servingUnit`/`servingBasisMultiplier` are derived from it on parse (the wire omits the duplicates). Recipe serving labels (`RecipeServingLabels`) are **not** carried — regenerated in the recipient's locale (existing `create` input).
- Parse validation (zod at the boundary, USDA-mapper pattern): exact markers + version, size cap (reject > 100 000 chars), name ≤ 80 chars, `servingsCount > 0`, weights/quantities/multipliers `> 0` or null, finite nutrients. Any failure → typed `AppError` category `'validation'`, no local writes (ARCH-13).

## Implementation steps

### 1. Spec updates (commit 1: `docs(spec): promote POST-16 recipe sharing into the MVP`)
- `docs/post-mvp.md`: POST-16 → tombstone "Moved into the MVP 2026-10-10 (user request). ID kept so it is not reused." Reword the linking clause: v1 creates local snapshots only; "link an imported ingredient to an existing local food" becomes a bullet in **POST-15 Recipe extras**.
- `docs/01-scope.md`: extend **SCOPE-13** with a sharing/import bullet (→ DATA-29, UX-28) + one-line **Why** clarifying SCOPE-10: offline person-to-person text only, no network/social features.
- `docs/03-data.md`: new **DATA-29 "Recipe text envelope & import"** (format above, import op, size cap, duplicates allowed = plain copies); add op row to DATA-16/DATA-28 tables.
- `docs/06-screens.md`: new **UX-28 Import Recipe** card; bullets in **UX-26** (edit-mode share action) and **UX-27** (`Import recipe` entry incl. empty state).
- `docs/02-navigation.md`: NAV-02 tree (Import Recipe in Profile stack), NAV-04 row (Confirm → back to My recipes + toast; Back with pasted text → `Discard changes?`), NAV-06 row.
- `docs/04-architecture.md`: fix ARCH-05 stale structure block.
- `docs/progress.md`: status-table row + new work section with tasks.

### 2. Envelope module
- New `src/features/recipes/recipeText.ts` (pure, no React): marker/version constants, `serializeRecipeText(recipe: Recipe): string`, `parseRecipeText(text: string): ParsedRecipe` (zod schemas), size cap. Items serialize kcal-only nutrients; `servingUnit`/`servingBasisMultiplier` are derived from the carried serving on parse.
- Unit tests `src/features/recipes/__tests__/recipeText.test.ts`: round-trip vs a fixture `Recipe`, wrong version, broken markers, oversized, bad values, meal-level unknown-nutrient preservation.

### 3. Repository import op
- `src/data/db/repositories/recipesRepository.ts`: `createImported(input)` — one transaction: insert snapshot custom `foods` (kcal only, + servings) then the recipe rows + `recomputeRecipe` (servings + raw weight) + store the sender's per-serving nutrition. Input: `ImportedRecipeInput { recipe: { name, servingsCount, cookedServingG, rawServingGOverride }, nutrition, ingredients: Array<{ food (kcal-only nutrients), quantity, servingUnit, servingBasisMultiplier }> }`.
- Tests in `src/data/db/repositories/__tests__/recipes.test.ts`: imported recipe's stored nutrition equals the envelope's sender values; snapshot foods carry kcal only and appear in `listCustom`.

### 4. Editor Copy / Share (UX-26 edit mode)
- `src/features/recipes/screens/RecipeEditorScreen.tsx`: in edit mode, add a `HeaderAction` (share icon, `testID="recipe-share"`) in the existing `AppBar actions` next to Save → opens `BottomSheet` action menu (AddActionSheet pattern) with rows:
  - `Copy recipe text` → `setStringAsync` from `expo-clipboard` (direct import, precedent: `CaloriesMacrosScreen`), then plain `UndoToast`-style confirmation toast.
  - `Share recipe` → `Share.share({ message: text })` from `react-native`; silent on `dismissedAction`; failure → error toast.
- Serialize from the **saved** recipe (`useRecipe` data), not the in-memory draft (predictable: you share what was saved).
- i18n keys under `recipe.*` (`recipe.share`, `recipe.copy`, toasts).

### 5. My recipes entry point (UX-27)
- `src/features/food-search/screens/MyFoodsScreen.tsx` (`variant="recipes"`): `Import recipe` `TextAction`, shown also in the empty state (empty copy becomes "No recipes yet. Create them from Food Search, or import one."); → `router.push(routes.importRecipe())`.

### 6. Import Recipe screen (UX-28)
- Routes (`src/shared/navigation/routes.ts`): `importRecipe: undefined` in `RouteParams`, `importRecipe: z.object({})` in `paramSchemas`, builder `importRecipe: () => '/profile/my-recipes/import'`.
- New `src/app/(tabs)/profile/my-recipes/import.tsx` wrapping new `src/features/recipes/screens/ImportRecipeScreen.tsx`.
- Flow: on mount read clipboard (`getStringAsync`) once, right after the user taps the action (POST-16); if a valid envelope is found → preview immediately; else show `FormField multiline` paste box + `Paste` button (fallback). Clipboard read failures/empty (e.g. Android 10–12 background-clipboard restrictions) land in the paste box silently — the OS may show its own "pasted" notice, so no app-side toast. Preview shows name, servings, weights, ingredient rows with quantities, sender nutrition labeled unverified. Primary `Import` → `createImported` → success toast → `router.back()` to My recipes. Parse/import failure → inline error, stay, keep text (UX-00 pattern from `QuickCaloriesScreen`). Back with non-empty text → `Discard changes?` (`ConfirmationDialog`, NAV-08).
- Tests `src/features/recipes/__tests__/ImportRecipeScreen.test.tsx` (renderWithServices): clipboard-import happy path asserts DB rows; malformed paste shows error and writes nothing; empty-list entry point.

### 7. i18n
- `src/shared/i18n/locales/en.json` + `pt-PT.json`: new `importRecipe` namespace + `recipe` copy/share keys (typed keys — both files required, parity test enforces).

### 8. Test mocks
- Per jest.setup's "per-suite mocks live next to suites": add `expo-clipboard` mock (`setStringAsync`/`getStringAsync`) and `Share.share` mock as suites need (shared helpers in `src/shared/testing/` if reused).

## Key files

| Change | File |
|---|---|
| Envelope build/parse | `src/features/recipes/recipeText.ts` (new) |
| Import transaction | `src/data/db/repositories/recipesRepository.ts` |
| Copy/Share actions | `src/features/recipes/screens/RecipeEditorScreen.tsx` |
| Import entry | `src/features/food-search/screens/MyFoodsScreen.tsx` |
| Import screen + route | `src/features/recipes/screens/ImportRecipeScreen.tsx` (new), `src/app/(tabs)/profile/my-recipes/import.tsx` (new), `src/shared/navigation/routes.ts` |
| Strings | `src/shared/i18n/locales/{en,pt-PT}.json` |
| Docs | `docs/{01-scope,02-navigation,03-data,04-architecture,06-screens,post-mvp,progress}.md` |

## Verification

- `npm run format:check` + `npm run check` (lint, typecheck, full jest suite — currently 104 suites / 724 tests, must stay green).
- New tests green: envelope round-trip/malformed; repo import stores sender nutrition; editor copy/share invocations; import screen happy/sad/empty paths; nav test for the new route.
- Manual device check: Copy → paste into Messages/WhatsApp shows the envelope; Share opens the OS share sheet; on a second device/emulator, My recipes → Import recipe (clipboard auto-read), preview matches, confirm → recipe + its foods appear and Food Detail shows expected kcal; pasting garbage → inline error, no data written; empty My recipes still offers Import.
