import { z } from 'zod';

import type { Recipe } from '@/data/db/repositories/recipesRepository';
import { isNutrientId } from '@/domain/nutrition/nutrientCatalog';
import type { Nutrients } from '@/domain/nutrition/nutrients';
import { ValidationError } from '@/shared/errors';

export const RECIPE_TEXT_START = '--- OPEN-KCAL-RECIPE v1 ---';
export const RECIPE_TEXT_END = '--- END OPEN-KCAL-RECIPE ---';
export const RECIPE_TEXT_MAX_CHARS = 100_000;

const finite = z.number().finite();
const positive = finite.positive();
const nonNegative = finite.nonnegative();
const nullableNonNegative = nonNegative.nullable();
const nutrientSchema = z.object({
  energyKcal: nonNegative,
  carbohydrateG: nullableNonNegative,
  proteinG: nullableNonNegative,
  fatG: nullableNonNegative,
  extra: z.record(z.string(), nonNegative).optional(),
});
const servingSchema = z.object({
  label: z.string().min(1).max(80),
  quantity: positive,
  unit: z.string().min(1).max(40),
  basisMultiplier: positive,
  isDefault: z.literal(true),
});
// DATA-29: items carry kcal only; the meal-level nutrition block carries the full nutrients.
const ingredientSchema = z.object({
  name: z.string().trim().min(1).max(80),
  brand: z.string().max(120).nullable(),
  basisQuantity: positive,
  basisUnit: z.string().min(1).max(40),
  nutrients: z.object({ energyKcal: nonNegative }),
  servings: z.array(servingSchema).min(1).max(1),
  quantity: positive,
});
const payloadSchema = z.object({
  version: z.literal(1),
  name: z.string().trim().min(1).max(80),
  servingsCount: positive,
  cookedServingG: positive.nullable(),
  rawServingGOverride: positive.nullable(),
  ingredients: z.array(ingredientSchema).min(1).max(500),
  nutrition: z.object({ perServing: nutrientSchema, total: nutrientSchema }),
});

type WireIngredient = z.infer<typeof ingredientSchema>;
export type ParsedIngredient = WireIngredient & {
  /** Derived from the carried serving definition (the wire omits the duplicates). */
  servingUnit: string;
  servingBasisMultiplier: number;
};
export type ParsedRecipe = Omit<z.infer<typeof payloadSchema>, 'ingredients'> & {
  ingredients: ParsedIngredient[];
};

const round2 = (value: number) => Math.round(value * 100) / 100;
const roundNullable = (value: number | null) => (value === null ? null : round2(value));
function roundedNutrients(value: Nutrients) {
  const extra = Object.fromEntries(Object.entries(value.extra ?? {}).map(([key, amount]) => [key, round2(amount)]));
  return {
    energyKcal: round2(value.energyKcal),
    carbohydrateG: roundNullable(value.carbohydrateG),
    proteinG: roundNullable(value.proteinG),
    fatG: roundNullable(value.fatG),
    ...(Object.keys(extra).length ? { extra } : {}),
  };
}

export function serializeRecipeText(recipe: Recipe): string {
  const payload: z.infer<typeof payloadSchema> = {
    version: 1,
    name: recipe.food.name,
    servingsCount: round2(recipe.servingsCount),
    cookedServingG: roundNullable(recipe.cookedServingG),
    rawServingGOverride: roundNullable(recipe.rawServingGOverride),
    ingredients: recipe.ingredients.map((ingredient) => {
      const selected = ingredient.food.servings.find((serving) => serving.id === ingredient.servingId);
      const servingBasisMultiplier =
        selected?.basisMultiplier ?? ingredient.basisMultiplierSnapshot / ingredient.quantity;
      const serving = selected ?? {
        label: ingredient.servingUnit,
        quantity: 1,
        unit: ingredient.servingUnit,
        basisMultiplier: servingBasisMultiplier,
        isDefault: true,
      };
      return {
        name: ingredient.food.name,
        brand: ingredient.food.brand,
        basisQuantity: round2(ingredient.food.basisQuantity),
        basisUnit: ingredient.food.basisUnit,
        nutrients: { energyKcal: round2(ingredient.food.nutrients.energyKcal) },
        servings: [
          {
            label: serving.label,
            quantity: round2(serving.quantity),
            unit: serving.unit,
            basisMultiplier: round2(servingBasisMultiplier),
            isDefault: true,
          },
        ],
        quantity: round2(ingredient.quantity),
      };
    }),
    nutrition: {
      perServing: roundedNutrients(recipe.food.nutrients),
      total: roundedNutrients({
        energyKcal: recipe.food.nutrients.energyKcal * recipe.servingsCount,
        carbohydrateG:
          recipe.food.nutrients.carbohydrateG === null
            ? null
            : recipe.food.nutrients.carbohydrateG * recipe.servingsCount,
        proteinG:
          recipe.food.nutrients.proteinG === null ? null : recipe.food.nutrients.proteinG * recipe.servingsCount,
        fatG: recipe.food.nutrients.fatG === null ? null : recipe.food.nutrients.fatG * recipe.servingsCount,
        ...(recipe.food.nutrients.extra
          ? {
              extra: Object.fromEntries(
                Object.entries(recipe.food.nutrients.extra).map(([id, amount]) => [id, amount * recipe.servingsCount]),
              ),
            }
          : {}),
      }),
    },
  };
  return `${RECIPE_TEXT_START}\n${JSON.stringify(payload)}\n${RECIPE_TEXT_END}`;
}

export function parseRecipeText(text: string): ParsedRecipe {
  if (text.length > RECIPE_TEXT_MAX_CHARS) throw new ValidationError('Recipe text is too large', ['text']);
  const match = /^--- OPEN-KCAL-RECIPE v(\d+) ---\n([\s\S]+)\n--- END OPEN-KCAL-RECIPE ---$/.exec(text);
  if (!match || match[1] !== '1') throw new ValidationError('Unsupported or malformed recipe text', ['text']);
  let json: unknown;
  try {
    json = JSON.parse(match[2]!);
  } catch {
    throw new ValidationError('Malformed recipe text', ['text']);
  }
  const parsed = payloadSchema.safeParse(json);
  if (!parsed.success) throw new ValidationError('Invalid recipe text', ['text']);
  const ingredients: ParsedIngredient[] = parsed.data.ingredients.map((ingredient) => ({
    ...ingredient,
    servingUnit: ingredient.servings[0]!.unit,
    servingBasisMultiplier: ingredient.servings[0]!.basisMultiplier,
  }));
  const nutritionValues = [parsed.data.nutrition.perServing, parsed.data.nutrition.total];
  for (const nutrients of nutritionValues) {
    if (Object.keys(nutrients.extra ?? {}).some((id) => !isNutrientId(id))) {
      throw new ValidationError('Invalid recipe nutrients', ['text']);
    }
  }
  return { ...parsed.data, ingredients };
}
