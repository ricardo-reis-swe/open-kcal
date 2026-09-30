import {
  DEFAULT_DASHBOARD_NUTRIENTS,
  isValidDashboardNutrients,
  moveDashboardNutrient,
  parseDashboardNutrients,
  setDashboardNutrientVisible,
  visibleDashboardNutrients,
} from '../dashboardNutrients';
import {
  NUTRIENT_CATALOG,
  NUTRIENT_IDS,
  convertNutrientUnit,
  knownNutrients,
  nutrientAmountsFromRows,
  nutrientGrams,
  withSaltAndSodium,
} from '../nutrientCatalog';
import { combineTotals, nutrientTotal, scaleNutrients, sumNutrients } from '../nutrients';

describe('DATA-20: nutrient catalog', () => {
  it('has 28 unique ids in four groups, alcohol excluded', () => {
    expect(NUTRIENT_IDS).toHaveLength(28);
    expect(new Set(NUTRIENT_IDS).size).toBe(28);
    expect(new Set(NUTRIENT_CATALOG.map((n) => n.group))).toEqual(
      new Set(['fatsSugars', 'minerals', 'vitamins', 'other']),
    );
    expect(NUTRIENT_IDS).not.toContain('alcohol');
  });

  it('converts g / mg / µg without rounding', () => {
    expect(convertNutrientUnit(1.5, 'g', 'mg')).toBe(1500);
    expect(convertNutrientUnit(250, 'µg', 'mg')).toBeCloseTo(0.25, 12);
    expect(nutrientGrams('vitamin_d', 10)).toBeCloseTo(1e-5, 12);
  });

  it('derives the missing one of salt / sodium (salt g = sodium mg × 2.5 ÷ 1000)', () => {
    expect(withSaltAndSodium({ sodium: 400 })).toEqual({ sodium: 400, salt: 1 });
    expect(withSaltAndSodium({ salt: 1 })).toEqual({ salt: 1, sodium: 400 });
    expect(withSaltAndSodium({ salt: 1, sodium: 380 })).toEqual({ salt: 1, sodium: 380 });
    expect(withSaltAndSodium({ fibre: 2 })).toEqual({ fibre: 2 });
  });

  it('lists known amounts in catalog order, keeps 0, and ignores ids outside the catalog on read', () => {
    expect(knownNutrients({ caffeine: 0, fibre: 3 })).toEqual([
      { id: 'fibre', amount: 3 },
      { id: 'caffeine', amount: 0 },
    ]);
    expect(
      nutrientAmountsFromRows([
        { nutrient_id: 'iron', amount: 2 },
        { nutrient_id: 'removed_nutrient', amount: 9 },
      ]),
    ).toEqual({ iron: 2 });
  });
});

describe('DATA-06 / DATA-20: nutrient math', () => {
  const base = { energyKcal: 100, carbohydrateG: 10, proteinG: null, fatG: 1 };

  it('scales extra amounts with kcal/macros and leaves foods without extras unchanged', () => {
    expect(scaleNutrients({ ...base, extra: { fibre: 4 } }, 0.5)).toEqual({
      energyKcal: 50,
      carbohydrateG: 5,
      proteinG: null,
      fatG: 0.5,
      extra: { fibre: 2 },
    });
    expect(scaleNutrients(base, 2)).not.toHaveProperty('extra');
  });

  it('totals keep known sums and count entries without a value as unknown', () => {
    const totals = sumNutrients([{ ...base, extra: { fibre: 4 } }, base, { ...base, extra: { fibre: 1, iron: 2 } }]);
    expect(nutrientTotal(totals, 'fibre')).toEqual({ knownSum: 5, unknownCount: 1 });
    expect(nutrientTotal(totals, 'iron')).toEqual({ knownSum: 2, unknownCount: 2 });
    expect(nutrientTotal(combineTotals([totals, sumNutrients([base])]), 'fibre')).toEqual({
      knownSum: 5,
      unknownCount: 2,
    });
  });
});

describe('DATA-21 / UX-21: dashboard nutrients', () => {
  it('defaults to fibre, sugars, saturated fat, salt, then every other id hidden', () => {
    expect(visibleDashboardNutrients(DEFAULT_DASHBOARD_NUTRIENTS)).toEqual([
      'fibre',
      'sugars',
      'saturated_fat',
      'salt',
    ]);
    expect(DEFAULT_DASHBOARD_NUTRIENTS.map((n) => n.id).sort()).toEqual([...NUTRIENT_IDS].sort());
  });

  it('reads tolerantly: unknown ids and duplicates dropped, missing ids appended hidden, junk → default', () => {
    const parsed = parseDashboardNutrients(
      JSON.stringify([
        { id: 'iron', visible: true },
        { id: 'gone', visible: true },
        { id: 'iron', visible: false },
      ]),
    );
    expect(visibleDashboardNutrients(parsed)).toEqual(['iron']);
    expect(parsed).toHaveLength(NUTRIENT_IDS.length);
    expect(parseDashboardNutrients('not json')).toEqual(DEFAULT_DASHBOARD_NUTRIENTS);
    expect(parseDashboardNutrients(JSON.stringify({ id: 'iron' }))).toEqual(DEFAULT_DASHBOARD_NUTRIENTS);
    expect(parseDashboardNutrients(null)).toEqual(DEFAULT_DASHBOARD_NUTRIENTS);
  });

  it('validates writes as every catalog id exactly once', () => {
    expect(isValidDashboardNutrients(DEFAULT_DASHBOARD_NUTRIENTS)).toBe(true);
    expect(isValidDashboardNutrients(DEFAULT_DASHBOARD_NUTRIENTS.slice(1))).toBe(false);
    expect(isValidDashboardNutrients([{ id: 'gone', visible: true }, ...DEFAULT_DASHBOARD_NUTRIENTS.slice(1)])).toBe(
      false,
    );
  });

  it('switching on appends after the last shown; off only hides; moves stay among the shown', () => {
    const on = setDashboardNutrientVisible(DEFAULT_DASHBOARD_NUTRIENTS, 'caffeine', true)!;
    expect(visibleDashboardNutrients(on)).toEqual(['fibre', 'sugars', 'saturated_fat', 'salt', 'caffeine']);
    const off = setDashboardNutrientVisible(on, 'sugars', false)!;
    expect(visibleDashboardNutrients(off)).toEqual(['fibre', 'saturated_fat', 'salt', 'caffeine']);
    expect(setDashboardNutrientVisible(off, 'sugars', false)).toBeNull();
    const moved = moveDashboardNutrient(off, 'caffeine', 0)!;
    expect(visibleDashboardNutrients(moved)).toEqual(['caffeine', 'fibre', 'saturated_fat', 'salt']);
    expect(moveDashboardNutrient(moved, 'caffeine', -5)).toBeNull();
    expect(moveDashboardNutrient(moved, 'iron', 0)).toBeNull();
    expect(isValidDashboardNutrients(moved)).toBe(true);
  });
});
