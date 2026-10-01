// Recipe math (SCOPE-13, DATA-27). Pure: a recipe's stored per-serving nutrition, raw weight and serving rows are
// computed from its ingredients. NULL = unknown (DATA-06): one unknown ingredient value makes the recipe value unknown.
import { NUTRIENT_IDS, type NutrientAmounts } from '@/domain/nutrition/nutrientCatalog';
import { scaleNutrients, type Nutrients } from '@/domain/nutrition/nutrients';
import { G_PER_OZ } from '@/domain/units/units';

/** DATA-27 recipe serving units. `serving` is a count; the others behave as g / oz on the ruler (UX-05). */
export const RECIPE_UNITS = ['serving', 'g_cooked', 'oz_cooked', 'g_raw', 'oz_raw'] as const;
export type RecipeUnit = (typeof RECIPE_UNITS)[number];

export const RECIPE_BASIS_UNIT = 'serving';

export function isRecipeUnit(unit: string): unit is RecipeUnit {
  return (RECIPE_UNITS as readonly string[]).includes(unit);
}

/** Localized display labels, written into `food_servings.label` at save time (like meal names, DATA-10). */
export type RecipeServingLabels = Record<RecipeUnit, string>;

/** An ingredient's food values the math needs (DATA-11 basis). */
export type IngredientFood = { basisQuantity: number; basisUnit: string; nutrients: Nutrients };

export type IngredientAmount = {
  food: IngredientFood;
  /** The serving's current multiplier, or `null` when `serving_id` no longer resolves. */
  servingBasisMultiplier: number | null;
  quantity: number;
  basisMultiplierSnapshot: number;
};

/** DATA-27: `serving.basis_multiplier × quantity` while the serving resolves, else the snapshot factor. */
export function ingredientFactor(ingredient: IngredientAmount): number {
  return ingredient.servingBasisMultiplier !== null && ingredient.servingBasisMultiplier > 0
    ? ingredient.servingBasisMultiplier * ingredient.quantity
    : ingredient.basisMultiplierSnapshot;
}

/** DATA-27: raw grams when the food's basis is grams; otherwise unknown (ml or count basis). */
export function ingredientRawGrams(ingredient: IngredientAmount): number | null {
  return ingredient.food.basisUnit === 'g' ? ingredientFactor(ingredient) * ingredient.food.basisQuantity : null;
}

const sumKnown = (values: readonly (number | null)[]): number | null =>
  values.some((value) => value === null) ? null : values.reduce<number>((sum, value) => sum + value!, 0);

/** The whole recipe's nutrition: kcal summed, a macro/nutrient known only when every ingredient knows it. */
export function recipeTotal(ingredients: readonly IngredientAmount[]): Nutrients {
  const parts = ingredients.map((ingredient) =>
    scaleNutrients(ingredient.food.nutrients, ingredientFactor(ingredient)),
  );
  const total: Nutrients = {
    energyKcal: parts.reduce((sum, part) => sum + part.energyKcal, 0),
    carbohydrateG: sumKnown(parts.map((part) => part.carbohydrateG)),
    proteinG: sumKnown(parts.map((part) => part.proteinG)),
    fatG: sumKnown(parts.map((part) => part.fatG)),
  };
  const extra: NutrientAmounts = {};
  if (parts.length > 0) {
    for (const id of NUTRIENT_IDS) {
      const value = sumKnown(parts.map((part) => part.extra?.[id] ?? null));
      if (value !== null) extra[id] = value;
    }
  }
  if (Object.keys(extra).length > 0) total.extra = extra;
  return total;
}

export type RecipeShape = {
  servingsCount: number;
  cookedServingG: number | null;
  rawServingGOverride: number | null;
};

/** DATA-27: Σ raw grams ÷ servings when every ingredient's raw grams are known; else `null`. */
export function computedRawServingG(ingredients: readonly IngredientAmount[], servingsCount: number): number | null {
  if (ingredients.length === 0 || !(servingsCount > 0)) return null;
  const grams = sumKnown(ingredients.map(ingredientRawGrams));
  return grams === null || !(grams > 0) ? null : grams / servingsCount;
}

/** The override wins; otherwise the computed value (which follows ingredient changes). */
export function rawServingG(ingredients: readonly IngredientAmount[], shape: RecipeShape): number | null {
  return shape.rawServingGOverride ?? computedRawServingG(ingredients, shape.servingsCount);
}

export type RecipeServingRow = {
  label: string;
  quantity: number;
  unit: RecipeUnit;
  basisMultiplier: number;
  isDefault: boolean;
};

/** DATA-27 servings for a per-1-serving basis: `serving` (default), then cooked and raw g/oz when known. */
export function recipeServingRows(
  cookedServingG: number | null,
  rawG: number | null,
  labels: RecipeServingLabels,
): RecipeServingRow[] {
  const rows: RecipeServingRow[] = [
    { label: labels.serving, quantity: 1, unit: 'serving', basisMultiplier: 1, isDefault: true },
  ];
  const weighed = (grams: number | null, g: RecipeUnit, oz: RecipeUnit) => {
    if (grams === null || !(grams > 0)) return;
    rows.push(
      { label: labels[g], quantity: 1, unit: g, basisMultiplier: 1 / grams, isDefault: false },
      { label: labels[oz], quantity: 1, unit: oz, basisMultiplier: G_PER_OZ / grams, isDefault: false },
    );
  };
  weighed(cookedServingG, 'g_cooked', 'oz_cooked');
  weighed(rawG, 'g_raw', 'oz_raw');
  return rows;
}

export type ComputedRecipe = {
  /** Stored on the food: per 1 serving (`basis_quantity = 1`, `basis_unit = 'serving'`). */
  perServing: Nutrients;
  total: Nutrients;
  rawServingG: number | null;
};

/** DATA-27: everything a recipe save (or an ingredient change) writes. */
export function computeRecipe(ingredients: readonly IngredientAmount[], shape: RecipeShape): ComputedRecipe {
  const total = recipeTotal(ingredients);
  return {
    total,
    perServing: scaleNutrients(total, 1 / shape.servingsCount),
    rawServingG: rawServingG(ingredients, shape),
  };
}
