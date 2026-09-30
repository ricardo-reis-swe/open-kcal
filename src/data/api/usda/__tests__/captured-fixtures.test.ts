import { mapUsdaFood, mapUsdaSearch } from '../mapper';

import branded from '../__fixtures__/captured/detail-2035482.json';
import fndds from '../__fixtures__/captured/detail-2705413.json';
import foundation from '../__fixtures__/captured/detail-747997.json';
import legacy from '../__fixtures__/captured/detail-174980.json';
import eggSearch from '../__fixtures__/captured/search-egg.json';

const basisServings = [
  { label: 'g', quantity: 1, unit: 'g', basisMultiplier: 0.01, isDefault: false },
  { label: 'oz', quantity: 1, unit: 'oz', basisMultiplier: 0.028349523125, isDefault: false },
];

describe('PROV-13: captured USDA fixtures', () => {
  it('maps the captured egg search and promotes every generic type before Branded results', () => {
    const result = mapUsdaSearch(eggSearch);

    expect(result).toMatchObject({ page: 1, pageCount: 2467 });
    expect(result.candidates.map(({ externalId }) => externalId)).toEqual([
      '747997',
      '748967',
      '748236',
      '2707180',
      '2707179',
      '2707181',
      '174901',
      '172673',
      '2708984',
      '2707343',
      '2708597',
      '2708602',
      '2707201',
      '2707199',
      '2707200',
      '2707205',
      '2707198',
      '2575290',
      '2171141',
      '2677671',
    ]);
    expect(result.candidates[0]).toMatchObject({
      input: {
        name: 'Eggs, Grade A, Large, egg white',
        nutrients: { energyKcal: 55, proteinG: 10.7, carbohydrateG: 2.36, fatG: 0 },
      },
    });
  });

  it.each([
    [
      'Foundation 747997',
      foundation,
      {
        externalId: '747997',
        input: {
          name: 'Eggs, Grade A, Large, egg white',
          brand: null,
          basisQuantity: 100,
          basisUnit: 'g',
          nutrients: { energyKcal: 55, proteinG: 10.7, carbohydrateG: 2.36, fatG: 0 },
          servings: [
            { label: 'egg, white', quantity: 1, unit: 'egg, white', basisMultiplier: 0.34, isDefault: true },
            { label: 'RACC', quantity: 1, unit: 'RACC', basisMultiplier: 0.5 },
            ...basisServings,
          ],
        },
      },
    ],
    [
      'SR Legacy 174980',
      legacy,
      {
        externalId: '174980',
        input: {
          name: 'Crackers, milk',
          brand: null,
          basisQuantity: 100,
          basisUnit: 'g',
          nutrients: { energyKcal: 446, proteinG: 7.6, carbohydrateG: 68.33, fatG: 13.77, extra: { fibre: 3.4 } },
          servings: [
            { label: 'cracker', quantity: 1, unit: 'cracker', basisMultiplier: 0.11, isDefault: true },
            ...basisServings,
          ],
        },
      },
    ],
    [
      'FNDDS 2705413',
      fndds,
      {
        externalId: '2705413',
        input: {
          name: 'Coconut milk',
          brand: null,
          basisQuantity: 100,
          basisUnit: 'g',
          nutrients: { energyKcal: 31, proteinG: 0.21, carbohydrateG: 2.92, fatG: 2.08, extra: { fibre: 0 } },
          servings: [
            { label: 'cup', quantity: 1, unit: 'cup', basisMultiplier: 2.44, isDefault: true },
            { label: 'fl oz', quantity: 1, unit: 'fl oz', basisMultiplier: 0.305 },
            ...basisServings,
          ],
        },
      },
    ],
    [
      'Branded 2035482',
      branded,
      {
        externalId: '2035482',
        input: {
          name: 'Greek yogurt',
          brand: 'Ocean spray',
          basisQuantity: 100,
          basisUnit: 'g',
          nutrients: { energyKcal: 467, proteinG: 3.33, carbohydrateG: 66.7, fatG: 20, extra: { fibre: 3.3 } },
          servings: [
            { label: 'serving', quantity: 1, unit: 'serving', basisMultiplier: 0.3, isDefault: true },
            { label: 'Tbsp', quantity: 1, unit: 'Tbsp', basisMultiplier: 0.15 },
            ...basisServings,
          ],
        },
      },
    ],
  ])('maps %s to its explicit persisted result', (_name, fixture, expected) => {
    expect(mapUsdaFood(fixture)).toEqual(expected);
  });
});
