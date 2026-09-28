import { mapUsdaFood, mapUsdaSearch, mapUsdaSearchFood } from '../mapper';

import branded from '../__fixtures__/synthetic-detail-branded.json';
import search from '../__fixtures__/synthetic-search-egg.json';

describe('PROV-05 / PROV-06 / PROV-07 / PROV-08: USDA mapping', () => {
  it('maps the documented search shape and stably promotes generic foods over Branded', () => {
    expect(mapUsdaSearch(search)).toEqual({
      page: 1,
      pageCount: 3,
      candidates: [
        {
          externalId: '1',
          input: expect.objectContaining({
            name: 'Egg, whole',
            basisQuantity: 100,
            basisUnit: 'g',
            nutrients: { energyKcal: 143, proteinG: 12.6, carbohydrateG: expect.closeTo(0.9, 10), fatG: 9.5 },
          }),
        },
        expect.objectContaining({ externalId: '2' }),
      ],
    });
  });

  it('maps the detail shape, all-caps values, fibre subtraction and branded servings', () => {
    expect(mapUsdaFood(branded)).toEqual({
      externalId: '2035482',
      input: expect.objectContaining({
        name: 'Peanut butter',
        brand: 'Example foods',
        basisUnit: 'g',
        nutrients: { energyKcal: 600, proteinG: 25, carbohydrateG: 19, fatG: 50 },
        servings: [
          expect.objectContaining({ label: 'serving', basisMultiplier: 0.3, isDefault: true }),
          expect.objectContaining({ label: 'Tbsp', basisMultiplier: 0.15 }),
          expect.objectContaining({ label: 'g', basisMultiplier: 0.01 }),
          expect.objectContaining({ label: 'oz', basisMultiplier: 0.028349523125 }),
        ],
      }),
    });
  });

  it('uses energy fallbacks and keeps unknown nutrients null without coercing to zero', () => {
    const candidate = mapUsdaFood({
      fdcId: 9,
      description: 'Fallback',
      dataType: 'Foundation',
      foodNutrients: [
        { nutrient: { number: '958', unitName: 'kcal' }, amount: 100 },
        { nutrient: { number: '203', unitName: 'mg' }, amount: 3 },
      ],
    });
    expect(candidate?.input.nutrients).toEqual({ energyKcal: 100, proteinG: null, carbohydrateG: null, fatG: null });
    expect(
      mapUsdaFood({
        fdcId: 10,
        description: 'Kilojoule',
        foodNutrients: [{ nutrient: { number: '268', unitName: 'kJ' }, amount: 418.4 }],
      })?.input.nutrients.energyKcal,
    ).toBeCloseTo(100, 10);
  });

  it('maps Foundation, FNDDS and SR Legacy portion shapes and skips filler/mass rows', () => {
    const food = (dataType: string, foodPortions: unknown[]) =>
      mapUsdaFood({
        fdcId: dataType,
        description: dataType,
        dataType,
        foodNutrients: [{ nutrient: { number: '208', unitName: 'kcal' }, amount: 100 }],
        foodPortions,
      })?.input.servings;
    expect(
      food('Foundation', [{ amount: 2, gramWeight: 100, measureUnit: { name: 'cup' }, modifier: 'chopped' }]),
    ).toEqual(expect.arrayContaining([expect.objectContaining({ label: 'cup, chopped', basisMultiplier: 0.5 })]));
    expect(
      food('Survey (FNDDS)', [
        { gramWeight: 120, portionDescription: '1.5 cup' },
        { gramWeight: 30, portionDescription: 'Quantity not specified' },
      ]),
    ).toEqual(expect.arrayContaining([expect.objectContaining({ label: 'cup', basisMultiplier: 0.8 })]));
    expect(
      food('SR Legacy', [
        { amount: 4, gramWeight: 20, modifier: 'cracker' },
        { amount: 1, gramWeight: 28, modifier: 'oz' },
      ]),
    ).toEqual(expect.arrayContaining([expect.objectContaining({ label: 'cracker', basisMultiplier: 0.05 })]));
  });

  it('uses label nutrients only as a Branded fallback and drops insufficient detail', () => {
    expect(
      mapUsdaFood({
        fdcId: 11,
        description: 'Drink',
        dataType: 'Branded',
        servingSize: 200,
        servingSizeUnit: 'ml',
        labelNutrients: { calories: { value: 80 }, carbohydrates: { value: 20 }, fiber: { value: 4 } },
        foodNutrients: [],
      }),
    ).toMatchObject({
      input: { basisUnit: 'ml', nutrients: { energyKcal: 40, carbohydrateG: 8, proteinG: null, fatG: null } },
    });
    expect(mapUsdaFood({ fdcId: 12, description: 'Empty', foodNutrients: [] })).toBeNull();
  });

  it('PROV-08: keeps a Branded gtinUpc as the dedupe barcode, never for generic foods', () => {
    const hit = {
      fdcId: 5,
      description: 'Oat bar',
      foodNutrients: [{ nutrientNumber: '208', unitName: 'KCAL', value: 400 }],
    };
    expect(mapUsdaSearchFood({ ...hit, dataType: 'Branded', gtinUpc: '00012345678905' })?.barcode).toBe(
      '00012345678905',
    );
    expect(mapUsdaSearchFood({ ...hit, dataType: 'Foundation', gtinUpc: '1' })).not.toHaveProperty('barcode');
  });
});
