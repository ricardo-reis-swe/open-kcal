import { G_PER_OZ } from '@/domain/units/units';

import {
  computeRecipe,
  computedRawServingG,
  ingredientFactor,
  recipeServingRows,
  recipeTotal,
  type IngredientAmount,
  type RecipeServingLabels,
} from '../recipe';
import { initialServing, rulerSpec } from '../servings';

const rice: IngredientAmount = {
  food: {
    basisQuantity: 100,
    basisUnit: 'g',
    nutrients: { energyKcal: 360, carbohydrateG: 80, proteinG: 7, fatG: 1, extra: { fibre: 1, salt: 0 } },
  },
  servingBasisMultiplier: 0.01,
  quantity: 400,
  basisMultiplierSnapshot: 4,
};
const chicken: IngredientAmount = {
  food: {
    basisQuantity: 100,
    basisUnit: 'g',
    nutrients: { energyKcal: 165, carbohydrateG: 0, proteinG: 31, fatG: 3.6, extra: { salt: 0.2 } },
  },
  servingBasisMultiplier: 0.01,
  quantity: 600,
  basisMultiplierSnapshot: 6,
};
const egg: IngredientAmount = {
  food: {
    basisQuantity: 1,
    basisUnit: 'egg',
    nutrients: { energyKcal: 78, carbohydrateG: 0.6, proteinG: null, fatG: 5 },
  },
  servingBasisMultiplier: 1,
  quantity: 2,
  basisMultiplierSnapshot: 2,
};

const labels: RecipeServingLabels = {
  serving: 'serving',
  g_cooked: 'g cooked',
  oz_cooked: 'oz cooked',
  g_raw: 'g raw',
  oz_raw: 'oz raw',
};

describe('DATA-27: recipe math', () => {
  it('uses the current serving multiplier, else the snapshot factor', () => {
    expect(ingredientFactor(rice)).toBe(4);
    expect(ingredientFactor({ ...rice, servingBasisMultiplier: null, basisMultiplierSnapshot: 3 })).toBe(3);
  });

  it('sums the ingredients; a nutrient row exists only when every ingredient knows it', () => {
    const total = recipeTotal([rice, chicken]);
    expect(total.energyKcal).toBeCloseTo(2430);
    expect(total.carbohydrateG).toBeCloseTo(320);
    expect(total.proteinG).toBeCloseTo(214);
    expect(total.extra).toEqual({ salt: expect.closeTo(1.2) });
  });

  it('DATA-06: one unknown macro makes the recipe macro unknown, never a partial sum', () => {
    const total = recipeTotal([rice, egg]);
    expect(total.proteinG).toBeNull();
    expect(total.fatG).toBeCloseTo(14);
    expect(total.extra).toBeUndefined();
  });

  it('SCOPE-13 example: 1 kg raw → 4 servings of 350 g cooked = 250 g raw', () => {
    const recipe = computeRecipe([rice, chicken], { servingsCount: 4, cookedServingG: 350, rawServingGOverride: null });
    expect(recipe.perServing.energyKcal).toBeCloseTo(607.5);
    expect(recipe.rawServingG).toBeCloseTo(250);
  });

  it('raw weight is unknown with a non-gram ingredient unless overridden', () => {
    expect(computedRawServingG([rice, egg], 2)).toBeNull();
    expect(
      computeRecipe([rice, egg], { servingsCount: 2, cookedServingG: null, rawServingGOverride: 230 }).rawServingG,
    ).toBe(230);
  });

  it('servings: serving (default), then cooked and raw g/oz when known', () => {
    const rows = recipeServingRows(350, 250, labels);
    expect(rows.map((row) => row.unit)).toEqual(['serving', 'g_cooked', 'oz_cooked', 'g_raw', 'oz_raw']);
    expect(rows[0]).toMatchObject({ basisMultiplier: 1, isDefault: true });
    expect(rows[1]!.basisMultiplier * 350).toBeCloseTo(1);
    expect(rows[2]!.basisMultiplier).toBeCloseTo(G_PER_OZ / 350);
    expect(rows[3]!.basisMultiplier * 250).toBeCloseTo(1);
    expect(recipeServingRows(null, null, labels).map((row) => row.unit)).toEqual(['serving']);
  });

  it('UX-05: recipe weights ruler like g / oz and the default serving starts at 1', () => {
    expect(rulerSpec({ label: 'g cooked', unit: 'g_cooked' })).toEqual(rulerSpec({ label: 'g', unit: 'g' }));
    expect(rulerSpec({ label: 'oz raw', unit: 'oz_raw' })).toEqual(rulerSpec({ label: 'oz', unit: 'oz' }));
    const servings = recipeServingRows(350, 250, labels).map((row, i) => ({ ...row, id: String(i) }));
    expect(initialServing(servings, null)).toEqual({ serving: servings[0], quantity: 1 });
  });
});
