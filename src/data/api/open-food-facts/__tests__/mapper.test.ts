import { mapOpenFoodFactsProduct, mapOpenFoodFactsSearch } from '../mapper';

describe('PROV-05 / PROV-07: Open Food Facts mapping', () => {
  const product = {
    code: '0894700010137',
    product_name: 'GREEK YOGURT',
    brands: 'Example Foods, Other',
    serving_quantity: '150',
    serving_size: '150 g',
    nutriments: { 'energy-kj_100g': '418.4', proteins_100g: '9', carbohydrates_100g: 4, fat_100g: 2 },
  };

  it('normalizes kJ, all-caps labels, brands and an authoritative serving quantity', () => {
    const candidate = mapOpenFoodFactsProduct(product);
    expect(candidate).toMatchObject({
      externalId: '0894700010137',
      input: {
        name: 'Greek yogurt',
        brand: 'Example Foods',
        basisQuantity: 100,
        basisUnit: 'g',
        nutrients: { proteinG: 9, carbohydrateG: 4, fatG: 2 },
      },
    });
    expect(candidate?.input.nutrients.energyKcal).toBeCloseTo(100, 10);
    expect(candidate?.input.servings[0]).toMatchObject({
      label: 'serving',
      basisMultiplier: 1.5,
      isDefault: true,
    });
  });

  it('drops hits with insufficient or clearly invalid nutrition without failing the section', () => {
    expect(
      mapOpenFoodFactsSearch({ hits: [{ code: 'empty', product_name: 'Empty', nutriments: {} }, product] }),
    ).toHaveLength(1);
    expect(
      mapOpenFoodFactsProduct({
        code: 'bad',
        product_name: 'Bad',
        nutriments: { 'energy-kcal_100g': 0, proteins_100g: 10 },
      }),
    ).toBeNull();
  });
});
