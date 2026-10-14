import type { Recipe } from '@/data/db/repositories/recipesRepository';

import { parseRecipeText, serializeRecipeText } from '../recipeText';

const recipe: Recipe = {
  food: {
    id: 'recipe',
    source: 'custom',
    kind: 'recipe',
    externalId: null,
    name: 'Rice bowl',
    brand: null,
    basisQuantity: 1,
    basisUnit: 'serving',
    nutrients: { energyKcal: 180.123, carbohydrateG: 40, proteinG: null, fatG: 2, extra: { fibre: 2.5 } },
    isDeleted: false,
    barcode: null,
    servings: [],
  },
  servingsCount: 2,
  cookedServingG: 150,
  rawServingGOverride: null,
  computedRawServingG: 50,
  ingredients: [
    {
      id: 'ingredient',
      food: {
        id: 'rice',
        source: 'custom',
        kind: 'food',
        externalId: null,
        name: 'Rice',
        brand: null,
        basisQuantity: 100,
        basisUnit: 'g',
        nutrients: { energyKcal: 360.125, carbohydrateG: 80, proteinG: null, fatG: 1, extra: { fibre: 1.123 } },
        isDeleted: false,
        barcode: null,
        servings: [
          { id: 'rice-g', label: 'g', quantity: 1, unit: 'g', basisMultiplier: 0.01, isDefault: true, sortOrder: 0 },
        ],
      },
      servingId: 'rice-g',
      servingUnit: 'g',
      quantity: 100,
      basisMultiplierSnapshot: 1,
      nutrients: { energyKcal: 360.125, carbohydrateG: 80, proteinG: null, fatG: 1 },
      amount: {
        food: {
          basisQuantity: 100,
          basisUnit: 'g',
          nutrients: { energyKcal: 360.125, carbohydrateG: 80, proteinG: null, fatG: 1 },
        },
        servingBasisMultiplier: 0.01,
        quantity: 100,
        basisMultiplierSnapshot: 1,
      },
    },
  ],
};

describe('DATA-29 recipe text', () => {
  it('round trips the envelope: kcal-only items, full meal-level nutrients', () => {
    const text = serializeRecipeText(recipe);
    const parsed = parseRecipeText(text);
    expect(parsed.version).toBe(1);
    expect(parsed.nutrition.perServing).toMatchObject({
      energyKcal: 180.12,
      carbohydrateG: 40,
      proteinG: null,
      fatG: 2,
    });
    expect(parsed.nutrition.perServing.extra?.fibre).toBe(2.5);
    expect(parsed.nutrition.total.extra?.fibre).toBe(5);
    expect(parsed.ingredients[0]?.nutrients).toEqual({ energyKcal: 360.13 });
    expect(parsed.ingredients[0]?.servingUnit).toBe('g');
    expect(parsed.ingredients[0]?.servingBasisMultiplier).toBe(0.01);
  });

  it.each([
    '--- OPEN-KCAL-RECIPE v2 ---\n{}\n--- END OPEN-KCAL-RECIPE ---',
    '--- OPEN-KCAL-RECIPE v1 ---\nnot-json\n--- END OPEN-KCAL-RECIPE ---',
    'heading\n--- OPEN-KCAL-RECIPE v1 ---\n{}\n--- END OPEN-KCAL-RECIPE ---',
  ])('rejects malformed or unsupported envelopes', (text) => {
    expect(() => parseRecipeText(text)).toThrow();
  });

  it('rejects oversized text and non-positive values', () => {
    expect(() => parseRecipeText('x'.repeat(100_001))).toThrow();
    const invalid = serializeRecipeText(recipe).replace('"servingsCount":2', '"servingsCount":0');
    expect(() => parseRecipeText(invalid)).toThrow();
  });
});
