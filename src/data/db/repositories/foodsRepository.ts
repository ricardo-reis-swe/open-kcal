// Foods + servings (DATA-11, DATA-15, DATA-16). Custom and saved external foods are soft-deleted; external foods are unique by
// (source, external_id) and re-fetching updates the existing row instead of duplicating it.
import {
  isNutrientId,
  knownNutrients,
  nutrientAmountsFromRows,
  withSaltAndSodium,
  type NutrientAmounts,
} from '@/domain/nutrition/nutrientCatalog';
import type { Nutrients } from '@/domain/nutrition/nutrients';
import {
  computeRecipe,
  isRecipeUnit,
  recipeServingRows,
  type IngredientAmount,
  type RecipeServingLabels,
} from '@/domain/food/recipe';
import { nowUtcIso, type UtcIso } from '@/shared/dates';
import { NotFoundError, ValidationError } from '@/shared/errors';

import type { SqlExecutor } from '../sql';
import type { RepositoryDeps } from './deps';

export type FoodSource = 'custom' | 'usda' | 'open_food_facts';
export type ExternalSource = Exclude<FoodSource, 'custom'>;
/** DATA-27: a recipe is a custom food made of other foods. */
export type FoodKind = 'food' | 'recipe';

export type FoodServing = {
  id: string;
  label: string;
  quantity: number;
  unit: string;
  basisMultiplier: number;
  isDefault: boolean;
  sortOrder: number;
};

export type Food = {
  id: string;
  source: FoodSource;
  kind: FoodKind;
  externalId: string | null;
  name: string;
  brand: string | null;
  basisQuantity: number;
  basisUnit: string;
  nutrients: Nutrients;
  isDeleted: boolean;
  servings: FoodServing[];
  /** DATA-24 GTIN-14, or `null`. */
  barcode: string | null;
};

export type ServingInput = Omit<FoodServing, 'id' | 'sortOrder' | 'isDefault'> & { isDefault?: boolean };

export type FoodInput = {
  name: string;
  brand?: string | null;
  basisQuantity: number;
  basisUnit: string;
  nutrients: Nutrients;
  servings: readonly ServingInput[];
  /** DATA-24: a valid GTIN-14 (`src/domain/food/barcode.ts`); anything else is stored as NULL. */
  barcode?: string | null;
};

export type CustomFoodInput = FoodInput;

export type CacheMetadata = {
  fetchedAt: UtcIso;
  expiresAt: UtcIso;
  rawPayloadJson: string | null;
  schemaVersion: number;
};

type FoodRow = {
  id: string;
  source: FoodSource;
  external_id: string | null;
  name: string;
  brand: string | null;
  basis_quantity: number;
  basis_unit: string;
  energy_kcal: number;
  protein_g: number | null;
  carbohydrate_g: number | null;
  fat_g: number | null;
  is_deleted: number;
  barcode: string | null;
  kind: FoodKind;
};
type ServingRow = {
  id: string;
  label: string;
  quantity: number;
  unit: string;
  basis_multiplier: number;
  is_default: number;
  sort_order: number;
};

const toServing = (r: ServingRow): FoodServing => ({
  id: r.id,
  label: r.label,
  quantity: r.quantity,
  unit: r.unit,
  basisMultiplier: r.basis_multiplier,
  isDefault: r.is_default === 1,
  sortOrder: r.sort_order,
});

const isNonNegative = (v: number | null) => v === null || (Number.isFinite(v) && v >= 0);

function validateFood(input: FoodInput): void {
  const bad: string[] = [];
  if (input.name.trim().length === 0) bad.push('name');
  if (!(Number.isFinite(input.basisQuantity) && input.basisQuantity > 0)) bad.push('basisQuantity');
  if (input.basisUnit.trim().length === 0) bad.push('basisUnit');
  if (!(Number.isFinite(input.nutrients.energyKcal) && input.nutrients.energyKcal >= 0)) bad.push('energyKcal');
  for (const key of ['carbohydrateG', 'proteinG', 'fatG'] as const) {
    const v = input.nutrients[key];
    if (!isNonNegative(v)) bad.push(key);
  }
  // DATA-20: catalog ids only, each a finite amount ≥ 0.
  for (const [id, v] of Object.entries(input.nutrients.extra ?? {})) {
    if (!isNutrientId(id) || !(typeof v === 'number' && Number.isFinite(v) && v >= 0)) bad.push(`extra.${id}`);
  }
  // DATA-11: a serving is selectable only with full conversion data.
  if (input.servings.length === 0) bad.push('servings');
  input.servings.forEach((s, i) => {
    if (s.label.trim().length === 0 || s.unit.trim().length === 0) bad.push(`servings.${i}`);
    if (!(s.quantity > 0 && s.basisMultiplier > 0)) bad.push(`servings.${i}`);
  });
  if (input.servings.filter((s) => s.isDefault).length > 1) bad.push('servings.default');
  if (bad.length > 0) throw new ValidationError('Invalid food', [...new Set(bad)]);
}

async function insertServings(
  tx: SqlExecutor,
  ids: RepositoryDeps['ids'],
  foodId: string,
  servings: readonly ServingInput[],
) {
  const defaultIndex = Math.max(
    0,
    servings.findIndex((s) => s.isDefault),
  );
  for (const [i, s] of servings.entries()) {
    await tx.run(
      `INSERT INTO food_servings (id, food_id, label, quantity, unit, basis_multiplier, is_default, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [ids.newId(), foodId, s.label.trim(), s.quantity, s.unit, s.basisMultiplier, i === defaultIndex ? 1 : 0, i],
    );
  }
}

/**
 * PROV-09 refresh: match existing servings by `(label, unit)` case-insensitively, update matches in place (their IDs,
 * and so `recent_foods.last_serving_id`, survive), insert new ones, delete missing ones.
 */
async function mergeServings(
  tx: SqlExecutor,
  ids: RepositoryDeps['ids'],
  foodId: string,
  servings: readonly ServingInput[],
) {
  const existing = await tx.getAll<{ id: string; label: string; unit: string }>(
    'SELECT id, label, unit FROM food_servings WHERE food_id = ?',
    [foodId],
  );
  const key = (label: string, unit: string) => `${label.trim().toLowerCase()}\u0000${unit.trim().toLowerCase()}`;
  const unmatched = new Map(existing.map((e) => [key(e.label, e.unit), e.id]));
  const defaultIndex = Math.max(
    0,
    servings.findIndex((s) => s.isDefault),
  );
  // Clear the flag first: the partial UNIQUE index allows one default per food at any moment.
  await tx.run('UPDATE food_servings SET is_default = 0 WHERE food_id = ?', [foodId]);
  for (const [i, s] of servings.entries()) {
    const k = key(s.label, s.unit);
    const matchId = unmatched.get(k);
    const values = [s.label.trim(), s.quantity, s.unit, s.basisMultiplier, i === defaultIndex ? 1 : 0, i];
    if (matchId) {
      unmatched.delete(k);
      await tx.run(
        `UPDATE food_servings SET label = ?, quantity = ?, unit = ?, basis_multiplier = ?, is_default = ?, sort_order = ?
         WHERE id = ?`,
        [...values, matchId],
      );
    } else {
      await tx.run(
        `INSERT INTO food_servings (id, food_id, label, quantity, unit, basis_multiplier, is_default, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [ids.newId(), foodId, ...values],
      );
    }
  }
  for (const id of unmatched.values()) {
    await tx.run('DELETE FROM food_servings WHERE id = ?', [id]); // recents' last_serving_id → NULL (FK)
  }
}

/** DATA-20: the food's catalog nutrient rows are replaced as a whole; salt/sodium are completed first. */
export async function writeFoodNutrients(tx: SqlExecutor, foodId: string, extra: NutrientAmounts | undefined) {
  await tx.run('DELETE FROM food_nutrients WHERE food_id = ?', [foodId]);
  for (const { id, amount } of knownNutrients(withSaltAndSodium(extra ?? {}))) {
    await tx.run('INSERT INTO food_nutrients (food_id, nutrient_id, amount) VALUES (?, ?, ?)', [foodId, id, amount]);
  }
}

export async function readFood(db: SqlExecutor, id: string): Promise<Food | null> {
  const row = await db.getFirst<FoodRow>('SELECT * FROM foods WHERE id = ?', [id]);
  if (!row) return null;
  const servings = await db.getAll<ServingRow>(
    'SELECT id, label, quantity, unit, basis_multiplier, is_default, sort_order FROM food_servings WHERE food_id = ? ORDER BY sort_order',
    [id],
  );
  const extra = nutrientAmountsFromRows(
    await db.getAll<{ nutrient_id: string; amount: number }>(
      'SELECT nutrient_id, amount FROM food_nutrients WHERE food_id = ?',
      [id],
    ),
  );
  return {
    id: row.id,
    source: row.source,
    kind: row.kind,
    externalId: row.external_id,
    name: row.name,
    brand: row.brand,
    basisQuantity: row.basis_quantity,
    basisUnit: row.basis_unit,
    nutrients: {
      energyKcal: row.energy_kcal,
      carbohydrateG: row.carbohydrate_g,
      proteinG: row.protein_g,
      fatG: row.fat_g,
      ...(Object.keys(extra).length > 0 ? { extra } : {}),
    },
    isDeleted: row.is_deleted === 1,
    servings: servings.map(toServing),
    barcode: row.barcode,
  };
}

type IngredientRow = {
  id: string;
  food_id: string;
  serving_id: string | null;
  quantity: number;
  serving_unit_snapshot: string;
  basis_multiplier_snapshot: number;
  sort_order: number;
  serving_basis_multiplier: number | null;
  serving_label: string | null;
};

export type RecipeRow = {
  servings_count: number;
  cooked_serving_g: number | null;
  raw_serving_g_override: number | null;
};

/** DATA-27: a recipe's ingredient rows (deleted foods too) with each food and its current serving, in order. */
export async function readRecipeIngredients(
  db: SqlExecutor,
  recipeId: string,
): Promise<(IngredientRow & { food: Food; amount: IngredientAmount })[]> {
  const rows = await db.getAll<IngredientRow>(
    `SELECT i.*, s.basis_multiplier AS serving_basis_multiplier, s.label AS serving_label
     FROM recipe_ingredients i LEFT JOIN food_servings s ON s.id = i.serving_id
     WHERE i.recipe_id = ? ORDER BY i.sort_order`,
    [recipeId],
  );
  return Promise.all(
    rows.map(async (row) => {
      const food = (await readFood(db, row.food_id))!;
      return {
        ...row,
        food,
        amount: {
          food,
          servingBasisMultiplier: row.serving_basis_multiplier,
          quantity: row.quantity,
          basisMultiplierSnapshot: row.basis_multiplier_snapshot,
        },
      };
    }),
  );
}

/**
 * DATA-27 servings, matched by `unit` (the role key) so their IDs, and so recents' last serving, survive. With `labels`
 * (a recipe save) every row is written with fresh labels; without (an ingredient-driven recompute) existing rows are
 * updated or removed and none is added.
 */
async function mergeRecipeServings(
  tx: SqlExecutor,
  ids: RepositoryDeps['ids'],
  recipeId: string,
  cookedServingG: number | null,
  rawServingG: number | null,
  labels: RecipeServingLabels | null,
) {
  const existing = await tx.getAll<{ id: string; label: string; unit: string }>(
    'SELECT id, label, unit FROM food_servings WHERE food_id = ?',
    [recipeId],
  );
  const byUnit = new Map(existing.filter((e) => isRecipeUnit(e.unit)).map((e) => [e.unit, e]));
  const fallback = { serving: '', g_cooked: '', oz_cooked: '', g_raw: '', oz_raw: '' };
  const rows = recipeServingRows(cookedServingG, rawServingG, labels ?? fallback);
  await tx.run('UPDATE food_servings SET is_default = 0 WHERE food_id = ?', [recipeId]);
  const kept = new Set<string>();
  for (const [i, row] of rows.entries()) {
    const match = byUnit.get(row.unit);
    if (match) {
      kept.add(match.id);
      await tx.run(
        'UPDATE food_servings SET label = ?, quantity = ?, basis_multiplier = ?, is_default = ?, sort_order = ? WHERE id = ?',
        [labels ? row.label : match.label, row.quantity, row.basisMultiplier, row.isDefault ? 1 : 0, i, match.id],
      );
    } else if (labels) {
      await tx.run(
        `INSERT INTO food_servings (id, food_id, label, quantity, unit, basis_multiplier, is_default, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [ids.newId(), recipeId, row.label, row.quantity, row.unit, row.basisMultiplier, row.isDefault ? 1 : 0, i],
      );
    }
  }
  for (const e of existing) {
    if (!kept.has(e.id)) await tx.run('DELETE FROM food_servings WHERE id = ?', [e.id]); // recents' serving → NULL
  }
}

/** DATA-27/28: recompute a recipe's stored per-serving nutrition, servings and nutrient rows from its ingredients. */
export async function recomputeRecipe(
  tx: SqlExecutor,
  ids: RepositoryDeps['ids'],
  recipeId: string,
  now: UtcIso,
  labels: RecipeServingLabels | null,
): Promise<void> {
  const recipe = await tx.getFirst<RecipeRow>('SELECT * FROM recipes WHERE food_id = ?', [recipeId]);
  if (!recipe) return;
  const ingredients = await readRecipeIngredients(tx, recipeId);
  const computed = computeRecipe(
    ingredients.map((i) => i.amount),
    {
      servingsCount: recipe.servings_count,
      cookedServingG: recipe.cooked_serving_g,
      rawServingGOverride: recipe.raw_serving_g_override,
    },
  );
  const n = computed.perServing;
  await tx.run(
    `UPDATE foods SET basis_quantity = 1, basis_unit = 'serving', energy_kcal = ?, protein_g = ?, carbohydrate_g = ?,
       fat_g = ?, updated_at = ? WHERE id = ?`,
    [n.energyKcal, n.proteinG, n.carbohydrateG, n.fatG, now, recipeId],
  );
  await mergeRecipeServings(tx, ids, recipeId, recipe.cooked_serving_g, computed.rawServingG, labels);
  await writeFoodNutrients(tx, recipeId, n.extra);
}

/** DATA-28: an ingredient food's values changed → every recipe using it is recomputed in the same transaction. */
async function recomputeRecipesUsing(tx: SqlExecutor, ids: RepositoryDeps['ids'], foodId: string, now: UtcIso) {
  const recipes = await tx.getAll<{ recipe_id: string }>(
    'SELECT DISTINCT recipe_id FROM recipe_ingredients WHERE food_id = ?',
    [foodId],
  );
  for (const { recipe_id } of recipes) await recomputeRecipe(tx, ids, recipe_id, now, null);
}

const foodValues = (input: FoodInput) => [
  input.name.trim(),
  input.brand?.trim() || null,
  input.basisQuantity,
  input.basisUnit,
  input.nutrients.energyKcal,
  input.nutrients.proteinG,
  input.nutrients.carbohydrateG,
  input.nutrients.fatG,
  input.barcode && /^\d{14}$/.test(input.barcode) ? input.barcode : null,
];

export function createFoodsRepository({ db, clock, ids }: RepositoryDeps) {
  return {
    async get(id: string): Promise<Food> {
      const food = await readFood(db, id);
      if (!food) throw new NotFoundError('Food not found');
      return food;
    },

    /** UX-04 / DATA-15: active custom-food matches for the local `My foods` section. */
    async searchCustom(query: string, limit = 20, offset = 0): Promise<Food[]> {
      const tokens = query.trim().split(/\s+/).filter(Boolean);
      if (tokens.length === 0 || !Number.isInteger(limit) || limit <= 0 || !Number.isInteger(offset) || offset < 0)
        return [];
      const normalized = tokens.join(' ');
      const matches = tokens
        .map(() => "(instr(lower(foods.name), lower(?)) > 0 OR instr(lower(COALESCE(foods.brand, '')), lower(?)) > 0)")
        .join(' AND ');
      const matchArgs = tokens.flatMap((token) => [token, token]);
      // PROV-08: a word start is the beginning of the name or follows whitespace.
      const wordStarts = tokens
        .map(() => '(lower(foods.name) LIKE lower(?) OR lower(foods.name) LIKE lower(?))')
        .join(' AND ');
      const wordArgs = tokens.flatMap((token) => [`${token}%`, `% ${token}%`]);
      const rows = await db.getAll<{ id: string }>(
        `SELECT foods.id FROM foods
         LEFT JOIN recent_foods ON recent_foods.food_id = foods.id
         WHERE foods.source = 'custom' AND foods.kind = 'food' AND foods.is_deleted = 0 AND ${matches}
         ORDER BY CASE
           WHEN lower(foods.name) = lower(?) THEN 0
           WHEN lower(foods.name) LIKE lower(?) THEN 1
           WHEN ${wordStarts} THEN 2
           ELSE 3
         END,
         COALESCE(recent_foods.use_count, 0) DESC, recent_foods.last_used_at DESC,
         length(foods.name), foods.id
         LIMIT ? OFFSET ?`,
        [...matchArgs, normalized, `${normalized}%`, ...wordArgs, limit, offset],
      );
      return Promise.all(rows.map(async ({ id }) => (await readFood(db, id))!));
    },

    /** DATA-25: every active custom food, most recently used first, then the newest created (UX-04 tab, UX-25). */
    async listCustom(limit = 20, offset = 0): Promise<Food[]> {
      if (!Number.isInteger(limit) || limit <= 0 || !Number.isInteger(offset) || offset < 0) return [];
      const rows = await db.getAll<{ id: string }>(
        `SELECT foods.id FROM foods
         LEFT JOIN recent_foods ON recent_foods.food_id = foods.id
         WHERE foods.source = 'custom' AND foods.kind = 'food' AND foods.is_deleted = 0
         ORDER BY recent_foods.last_used_at IS NULL, recent_foods.last_used_at DESC, foods.created_at DESC, foods.id
         LIMIT ? OFFSET ?`,
        [limit, offset],
      );
      return Promise.all(rows.map(async ({ id }) => (await readFood(db, id))!));
    },

    /** DATA-25: the Profile `My foods` row count (UX-15). */
    async countCustom(): Promise<number> {
      const row = await db.getFirst<{ count: number }>(
        "SELECT COUNT(*) AS count FROM foods WHERE source = 'custom' AND kind = 'food' AND is_deleted = 0",
      );
      return row?.count ?? 0;
    },

    /** PROV-08 / DATA-15: cached external foods remain searchable even when their refresh TTL has expired. */
    async searchExternal(query: string, limit = 20, offset = 0): Promise<Food[]> {
      const tokens = query.trim().split(/\s+/).filter(Boolean);
      if (tokens.length === 0 || !Number.isInteger(limit) || limit <= 0 || !Number.isInteger(offset) || offset < 0)
        return [];
      const normalized = tokens.join(' ');
      const matches = tokens
        .map(() => "(instr(lower(foods.name), lower(?)) > 0 OR instr(lower(COALESCE(foods.brand, '')), lower(?)) > 0)")
        .join(' AND ');
      const matchArgs = tokens.flatMap((token) => [token, token]);
      const wordStarts = tokens
        .map(() => '(lower(foods.name) LIKE lower(?) OR lower(foods.name) LIKE lower(?))')
        .join(' AND ');
      const wordArgs = tokens.flatMap((token) => [`${token}%`, `% ${token}%`]);
      const rows = await db.getAll<{ id: string }>(
        `SELECT foods.id FROM foods
         JOIN food_cache_metadata ON food_cache_metadata.food_id = foods.id
         LEFT JOIN recent_foods ON recent_foods.food_id = foods.id
         WHERE foods.source IN ('usda', 'open_food_facts') AND foods.is_deleted = 0 AND ${matches}
         ORDER BY CASE
           WHEN lower(foods.name) = lower(?) THEN 0
           WHEN lower(foods.name) LIKE lower(?) THEN 1
           WHEN ${wordStarts} THEN 2
           ELSE 3
         END,
         COALESCE(recent_foods.use_count, 0) DESC, recent_foods.last_used_at DESC,
         length(foods.name), foods.id LIMIT ? OFFSET ?`,
        [...matchArgs, normalized, `${normalized}%`, ...wordArgs, limit, offset],
      );
      return Promise.all(rows.map(async ({ id }) => (await readFood(db, id))!));
    },

    /** DATA-24 / PROV-15: the active food for a GTIN-14 — custom first, then most recently used, then updated. */
    async findByBarcode(gtin14: string): Promise<Food | null> {
      if (!/^\d{14}$/.test(gtin14)) return null;
      const row = await db.getFirst<{ id: string }>(
        `SELECT foods.id FROM foods
         LEFT JOIN recent_foods ON recent_foods.food_id = foods.id
         WHERE foods.barcode = ? AND foods.is_deleted = 0
         ORDER BY foods.source = 'custom' DESC, recent_foods.last_used_at IS NULL, recent_foods.last_used_at DESC,
           foods.updated_at DESC, foods.id
         LIMIT 1`,
        [gtin14],
      );
      return row ? readFood(db, row.id) : null;
    },

    /** DATA-16: validate → insert `custom` food → insert ≥1 servings (one default). Does not create an entry. */
    async createCustom(input: CustomFoodInput): Promise<Food> {
      validateFood(input);
      return db.transaction(async (tx) => {
        const now = nowUtcIso(clock);
        const id = ids.newId();
        await tx.run(
          `INSERT INTO foods (id, source, external_id, name, brand, basis_quantity, basis_unit, energy_kcal, protein_g,
             carbohydrate_g, fat_g, barcode, is_deleted, created_at, updated_at)
           VALUES (?, 'custom', NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
          [id, ...foodValues(input), now, now],
        );
        await insertServings(tx, ids, id, input.servings);
        await writeFoodNutrients(tx, id, input.nutrients.extra);
        return (await readFood(tx, id))!;
      });
    },

    /**
     * DATA-26 / UX-25: edit an active custom food in place. Servings merge by `(label, unit)` (IDs, and so recents'
     * last serving, survive); nutrient rows are replaced; the barcode is kept. Diary snapshots never change (DATA-05).
     */
    async updateCustom(id: string, input: CustomFoodInput): Promise<Food> {
      validateFood(input);
      return db.transaction(async (tx) => {
        const { changes } = await tx.run(
          `UPDATE foods SET name = ?, brand = ?, basis_quantity = ?, basis_unit = ?, energy_kcal = ?, protein_g = ?,
             carbohydrate_g = ?, fat_g = ?, updated_at = ?
           WHERE id = ? AND source = 'custom' AND kind = 'food' AND is_deleted = 0`,
          [...foodValues(input).slice(0, 8), nowUtcIso(clock), id],
        );
        if (changes === 0) throw new NotFoundError('Custom food not found');
        await mergeServings(tx, ids, id, input.servings);
        await writeFoodNutrients(tx, id, input.nutrients.extra);
        await recomputeRecipesUsing(tx, ids, id, nowUtcIso(clock)); // DATA-28
        return (await readFood(tx, id))!;
      });
    },

    /** DATA-11: soft delete of a custom or saved external food. Entries keep their snapshots; it leaves search and recents. */
    async deleteFood(id: string): Promise<void> {
      const { changes } = await db.run('UPDATE foods SET is_deleted = 1, updated_at = ? WHERE id = ?', [
        nowUtcIso(clock),
        id,
      ]);
      if (changes === 0) throw new NotFoundError('Food not found');
    },

    /** DATA-11: Undo reactivates a soft-deleted food without changing its servings or history. */
    async restoreFood(id: string): Promise<void> {
      const { changes } = await db.run(
        'UPDATE foods SET is_deleted = 0, updated_at = ? WHERE id = ? AND is_deleted = 1',
        [nowUtcIso(clock), id],
      );
      if (changes === 0) throw new NotFoundError('Deleted food not found');
    },

    /**
     * DATA-15: upsert a remote food + servings + cache metadata before logging, keyed on (source, external_id),
     * so it gets a stable local id and offline reuse. Servings are merged by `(label, unit)` (PROV-09).
     */
    async upsertExternal(
      source: ExternalSource,
      externalId: string,
      input: FoodInput,
      cache: CacheMetadata,
    ): Promise<Food> {
      validateFood(input);
      if (externalId.trim().length === 0) throw new ValidationError('Missing external id', ['externalId']);
      return db.transaction(async (tx) => {
        const now = nowUtcIso(clock);
        // DATA-11: re-selecting a deleted saved food from its provider saves it again.
        const existing = await tx.getFirst<{ id: string }>(
          'SELECT id FROM foods WHERE source = ? AND external_id = ?',
          [source, externalId],
        );
        const id = existing?.id ?? ids.newId();
        if (existing) {
          await tx.run(
            `UPDATE foods SET name = ?, brand = ?, basis_quantity = ?, basis_unit = ?, energy_kcal = ?, protein_g = ?,
               carbohydrate_g = ?, fat_g = ?, barcode = ?, is_deleted = 0, updated_at = ? WHERE id = ?`,
            [...foodValues(input), now, id],
          );
          await mergeServings(tx, ids, id, input.servings);
        } else {
          await tx.run(
            `INSERT INTO foods (id, source, external_id, name, brand, basis_quantity, basis_unit, energy_kcal, protein_g,
               carbohydrate_g, fat_g, barcode, is_deleted, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
            [id, source, externalId, ...foodValues(input), now, now],
          );
          await insertServings(tx, ids, id, input.servings);
        }
        // DATA-20: a refresh replaces the rows; a nutrient missing from the new response becomes unknown.
        await writeFoodNutrients(tx, id, input.nutrients.extra);
        if (existing) await recomputeRecipesUsing(tx, ids, id, now); // DATA-28
        await tx.run(
          `INSERT INTO food_cache_metadata (food_id, fetched_at, expires_at, raw_payload_json, schema_version)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT (food_id) DO UPDATE SET fetched_at = excluded.fetched_at, expires_at = excluded.expires_at,
             raw_payload_json = excluded.raw_payload_json, schema_version = excluded.schema_version`,
          [id, cache.fetchedAt, cache.expiresAt, cache.rawPayloadJson, cache.schemaVersion],
        );
        return (await readFood(tx, id))!;
      });
    },

    /** Expiry controls refresh, not validity: expired foods stay loggable offline (DATA-15). */
    async cacheMetadata(foodId: string): Promise<(CacheMetadata & { isExpired: boolean }) | null> {
      const row = await db.getFirst<{
        fetched_at: string;
        expires_at: string;
        raw_payload_json: string | null;
        schema_version: number;
      }>('SELECT fetched_at, expires_at, raw_payload_json, schema_version FROM food_cache_metadata WHERE food_id = ?', [
        foodId,
      ]);
      if (!row) return null;
      return {
        fetchedAt: row.fetched_at,
        expiresAt: row.expires_at,
        rawPayloadJson: row.raw_payload_json,
        schemaVersion: row.schema_version,
        isExpired: row.expires_at <= nowUtcIso(clock),
      };
    },
  };
}

export type FoodsRepository = ReturnType<typeof createFoodsRepository>;
