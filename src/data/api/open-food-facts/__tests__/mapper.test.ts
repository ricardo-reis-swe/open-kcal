import { mapOpenFoodFactsProduct, mapOpenFoodFactsSearch } from '../mapper';

import capturedProduct from '../__fixtures__/product-5601009983179.json';
import capturedSearch from '../__fixtures__/search-iogurte-grego.json';

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

  it('maps the sanitized captured search and product contract fixtures', () => {
    const search = mapOpenFoodFactsSearch(capturedSearch);
    expect(search).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ externalId: '7891000360361' }),
        expect.objectContaining({ externalId: '5601009983179' }),
      ]),
    );
    expect(mapOpenFoodFactsProduct(capturedProduct.product)).toMatchObject({
      externalId: '5601009983179',
      input: {
        name: 'Iogurte Grego',
        basisUnit: 'g',
        nutrients: { energyKcal: 125.1, carbohydrateG: 11.3, proteinG: 2.5, fatG: 7.7 },
      },
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

  it('uses serving fallbacks and creates a liquid basis plus a parsed count serving', () => {
    const candidate = mapOpenFoodFactsProduct({
      code: 'liquid',
      product_name: 'OAT DRINK',
      quantity: '1 l',
      serving_quantity: '200',
      serving_size: '2 glasses (200 ml)',
      nutriments: {
        'energy-kj_serving': '400',
        proteins_serving: '2',
        carbohydrates_serving: '8',
        fat_serving: '3',
      },
    });
    expect(candidate).toMatchObject({
      input: {
        name: 'Oat drink',
        basisUnit: 'ml',
        nutrients: { energyKcal: expect.closeTo(47.801, 3), proteinG: 1, carbohydrateG: 4, fatG: 1.5 },
      },
    });
    expect(candidate?.input.servings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'serving', basisMultiplier: 2, isDefault: true }),
        expect.objectContaining({ label: 'glasses', basisMultiplier: 1 }),
        expect.objectContaining({ label: 'ml' }),
        expect.objectContaining({ label: 'fl oz' }),
      ]),
    );
  });

  it('drops malformed individual hits and treats invalid macros as unknown', () => {
    const candidates = mapOpenFoodFactsSearch({
      hits: [
        { code: 'too-many-macros', product_name: 'Nope', nutriments: { 'energy-kcal_100g': 100, proteins_100g: 101 } },
        { product_name: 'No id', nutriments: { 'energy-kcal_100g': 100 } },
        product,
      ],
    });
    expect(candidates).toHaveLength(2);
    expect(candidates[0]?.input.nutrients.proteinG).toBeNull();
    expect(
      mapOpenFoodFactsProduct({
        code: 'too-much-energy',
        product_name: 'Nope',
        nutriments: { 'energy-kcal_100g': 901 },
      }),
    ).toBeNull();
  });
});
