// Recipes (SCOPE-13, DATA-27, DATA-28). A recipe is a `foods` row (`kind = 'recipe'`) whose per-serving nutrition is
// computed from its ingredients and stored, so every logging path treats it as any food. Delete/Undo use the foods
// repository (DATA-11).
import {
  computedRawServingG,
  ingredientFactor,
  type IngredientAmount,
  type RecipeServingLabels,
} from '@/domain/food/recipe';
import { scaleNutrients, type Nutrients } from '@/domain/nutrition/nutrients';
import { nowUtcIso } from '@/shared/dates';
import { NotFoundError, ValidationError } from '@/shared/errors';

import type { SqlExecutor } from '../sql';
import type { RepositoryDeps } from './deps';
import { readFood, readRecipeIngredients, recomputeRecipe, type Food, type RecipeRow } from './foodsRepository';

export type RecipeIngredientInput = {
  foodId: string;
  /** A serving of that food; `null` keeps an existing ingredient whose serving is gone (its snapshot factor). */
  servingId: string | null;
  quantity: number;
  /** Required when `servingId` is null: the ingredient's stored snapshot (DATA-27). */
  snapshot?: { servingUnit: string; basisMultiplier: number };
};

export type RecipeInput = {
  name: string;
  servingsCount: number;
  cookedServingG: number | null;
  rawServingGOverride: number | null;
  ingredients: readonly RecipeIngredientInput[];
  /** Localized serving labels, written at save time (DATA-27). */
  labels: RecipeServingLabels;
};

export type RecipeIngredient = {
  id: string;
  food: Food;
  servingId: string | null;
  /** The serving's current label, else the snapshot. */
  servingUnit: string;
  quantity: number;
  basisMultiplierSnapshot: number;
  /** This ingredient's contribution, unrounded. */
  nutrients: Nutrients;
  amount: IngredientAmount;
};

export type Recipe = {
  food: Food;
  servingsCount: number;
  cookedServingG: number | null;
  rawServingGOverride: number | null;
  /** DATA-27 Σ raw grams ÷ servings, or `null` when an ingredient's raw grams are unknown. */
  computedRawServingG: number | null;
  ingredients: RecipeIngredient[];
};

const positive = (v: number) => Number.isFinite(v) && v > 0;
const positiveOrNull = (v: number | null) => v === null || positive(v);

function validateShape(input: RecipeInput) {
  const bad: string[] = [];
  if (input.name.trim().length === 0) bad.push('name');
  if (!positive(input.servingsCount)) bad.push('servingsCount');
  if (!positiveOrNull(input.cookedServingG)) bad.push('cookedServingG');
  if (!positiveOrNull(input.rawServingGOverride)) bad.push('rawServingGOverride');
  if (input.ingredients.length === 0) bad.push('ingredients');
  input.ingredients.forEach((i, index) => {
    if (!positive(i.quantity)) bad.push(`ingredients.${index}`);
  });
  if (bad.length > 0) throw new ValidationError('Invalid recipe', [...new Set(bad)]);
}

/** Resolves each ingredient's serving → snapshot unit + factor; rejects recipes and foreign servings (POST-15). */
async function resolveIngredients(tx: SqlExecutor, recipeId: string | null, input: RecipeInput) {
  const resolved: { foodId: string; servingId: string | null; quantity: number; unit: string; factor: number }[] = [];
  for (const [index, ingredient] of input.ingredients.entries()) {
    const food = await readFood(tx, ingredient.foodId);
    if (!food || food.kind === 'recipe' || food.id === recipeId) {
      throw new ValidationError('Invalid ingredient', [`ingredients.${index}`]);
    }
    if (ingredient.servingId !== null) {
      const serving = food.servings.find((s) => s.id === ingredient.servingId);
      if (!serving) throw new ValidationError('Invalid ingredient serving', [`ingredients.${index}`]);
      resolved.push({
        foodId: food.id,
        servingId: serving.id,
        quantity: ingredient.quantity,
        unit: serving.label,
        factor: serving.basisMultiplier * ingredient.quantity,
      });
    } else {
      const snapshot = ingredient.snapshot;
      if (!snapshot || !positive(snapshot.basisMultiplier) || snapshot.servingUnit.trim().length === 0) {
        throw new ValidationError('Invalid ingredient serving', [`ingredients.${index}`]);
      }
      resolved.push({
        foodId: food.id,
        servingId: null,
        quantity: ingredient.quantity,
        unit: snapshot.servingUnit,
        factor: snapshot.basisMultiplier,
      });
    }
  }
  return resolved;
}

async function writeIngredients(
  tx: SqlExecutor,
  ids: RepositoryDeps['ids'],
  recipeId: string,
  ingredients: Awaited<ReturnType<typeof resolveIngredients>>,
) {
  await tx.run('DELETE FROM recipe_ingredients WHERE recipe_id = ?', [recipeId]);
  for (const [i, ingredient] of ingredients.entries()) {
    await tx.run(
      `INSERT INTO recipe_ingredients (id, recipe_id, food_id, serving_id, quantity, serving_unit_snapshot,
         basis_multiplier_snapshot, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        ids.newId(),
        recipeId,
        ingredient.foodId,
        ingredient.servingId,
        ingredient.quantity,
        ingredient.unit,
        ingredient.factor,
        i,
      ],
    );
  }
}

export async function readRecipe(db: SqlExecutor, id: string): Promise<Recipe | null> {
  const food = await readFood(db, id);
  const row = await db.getFirst<RecipeRow>('SELECT * FROM recipes WHERE food_id = ?', [id]);
  if (!food || food.kind !== 'recipe' || !row) return null;
  const rows = await readRecipeIngredients(db, id);
  return {
    food,
    servingsCount: row.servings_count,
    cookedServingG: row.cooked_serving_g,
    rawServingGOverride: row.raw_serving_g_override,
    computedRawServingG: computedRawServingG(
      rows.map((r) => r.amount),
      row.servings_count,
    ),
    ingredients: rows.map((r) => ({
      id: r.id,
      food: r.food,
      servingId: r.serving_id,
      servingUnit: r.serving_label ?? r.serving_unit_snapshot,
      quantity: r.quantity,
      basisMultiplierSnapshot: r.basis_multiplier_snapshot,
      nutrients: scaleNutrients(r.food.nutrients, ingredientFactor(r.amount)),
      amount: r.amount,
    })),
  };
}

export function createRecipesRepository({ db, clock, ids }: RepositoryDeps) {
  return {
    async get(id: string): Promise<Recipe> {
      const recipe = await readRecipe(db, id);
      if (!recipe) throw new NotFoundError('Recipe not found');
      return recipe;
    },

    /** DATA-28: validate → compute (DATA-27) → food + servings + nutrients + recipe + ingredients. No entry. */
    async create(input: RecipeInput): Promise<Food> {
      validateShape(input);
      return db.transaction(async (tx) => {
        const now = nowUtcIso(clock);
        const id = ids.newId();
        const ingredients = await resolveIngredients(tx, null, input);
        await tx.run(
          `INSERT INTO foods (id, source, kind, external_id, name, brand, basis_quantity, basis_unit, energy_kcal,
             is_deleted, created_at, updated_at)
           VALUES (?, 'custom', 'recipe', NULL, ?, NULL, 1, 'serving', 0, 0, ?, ?)`,
          [id, input.name.trim(), now, now],
        );
        await tx.run(
          'INSERT INTO recipes (food_id, servings_count, cooked_serving_g, raw_serving_g_override) VALUES (?, ?, ?, ?)',
          [id, input.servingsCount, input.cookedServingG, input.rawServingGOverride],
        );
        await writeIngredients(tx, ids, id, ingredients);
        await recomputeRecipe(tx, ids, id, now, input.labels);
        return (await readFood(tx, id))!;
      });
    },

    /** DATA-28: active recipes only. Servings merge by unit; diary entries keep their snapshots (DATA-05). */
    async update(id: string, input: RecipeInput): Promise<Food> {
      validateShape(input);
      return db.transaction(async (tx) => {
        const now = nowUtcIso(clock);
        const { changes } = await tx.run(
          "UPDATE foods SET name = ?, updated_at = ? WHERE id = ? AND kind = 'recipe' AND is_deleted = 0",
          [input.name.trim(), now, id],
        );
        if (changes === 0) throw new NotFoundError('Recipe not found');
        const ingredients = await resolveIngredients(tx, id, input);
        await tx.run(
          'UPDATE recipes SET servings_count = ?, cooked_serving_g = ?, raw_serving_g_override = ? WHERE food_id = ?',
          [input.servingsCount, input.cookedServingG, input.rawServingGOverride, id],
        );
        await writeIngredients(tx, ids, id, ingredients);
        await recomputeRecipe(tx, ids, id, now, input.labels);
        return (await readFood(tx, id))!;
      });
    },

    /** DATA-28 / DATA-25 order: last used first (never used last), then newest created. */
    async list(limit = 20, offset = 0): Promise<Food[]> {
      if (!Number.isInteger(limit) || limit <= 0 || !Number.isInteger(offset) || offset < 0) return [];
      const rows = await db.getAll<{ id: string }>(
        `SELECT foods.id FROM foods
         LEFT JOIN recent_foods ON recent_foods.food_id = foods.id
         WHERE foods.kind = 'recipe' AND foods.is_deleted = 0
         ORDER BY recent_foods.last_used_at IS NULL, recent_foods.last_used_at DESC, foods.created_at DESC, foods.id
         LIMIT ? OFFSET ?`,
        [limit, offset],
      );
      return Promise.all(rows.map(async ({ id }) => (await readFood(db, id))!));
    },

    /** UX-15 `My recipes` count. */
    async count(): Promise<number> {
      const row = await db.getFirst<{ count: number }>(
        "SELECT COUNT(*) AS count FROM foods WHERE kind = 'recipe' AND is_deleted = 0",
      );
      return row?.count ?? 0;
    },

    /** DATA-28 / PROV-08: local match + rank over active recipes (UX-04 `Recipes` tab). */
    async search(query: string, limit = 20, offset = 0): Promise<Food[]> {
      const tokens = query.trim().split(/\s+/).filter(Boolean);
      if (tokens.length === 0 || !Number.isInteger(limit) || limit <= 0 || !Number.isInteger(offset) || offset < 0)
        return [];
      const normalized = tokens.join(' ');
      const matches = tokens.map(() => 'instr(lower(foods.name), lower(?)) > 0').join(' AND ');
      const wordStarts = tokens
        .map(() => '(lower(foods.name) LIKE lower(?) OR lower(foods.name) LIKE lower(?))')
        .join(' AND ');
      const wordArgs = tokens.flatMap((token) => [`${token}%`, `% ${token}%`]);
      const rows = await db.getAll<{ id: string }>(
        `SELECT foods.id FROM foods
         LEFT JOIN recent_foods ON recent_foods.food_id = foods.id
         WHERE foods.kind = 'recipe' AND foods.is_deleted = 0 AND ${matches}
         ORDER BY CASE
           WHEN lower(foods.name) = lower(?) THEN 0
           WHEN lower(foods.name) LIKE lower(?) THEN 1
           WHEN ${wordStarts} THEN 2
           ELSE 3
         END,
         COALESCE(recent_foods.use_count, 0) DESC, recent_foods.last_used_at DESC,
         length(foods.name), foods.id
         LIMIT ? OFFSET ?`,
        [...tokens, normalized, `${normalized}%`, ...wordArgs, limit, offset],
      );
      return Promise.all(rows.map(async ({ id }) => (await readFood(db, id))!));
    },
  };
}

export type RecipesRepository = ReturnType<typeof createRecipesRepository>;
