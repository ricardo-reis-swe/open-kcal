import { combineTotals, servingNutrients, sumNutrients, type Nutrients } from '../nutrients';

const egg100g: Nutrients = { energyKcal: 143, carbohydrateG: 0.7, proteinG: 12.6, fatG: 9.5 };

describe('DATA-11: serving math', () => {
  it('computes basis × basis_multiplier × ruler value, unrounded', () => {
    // 2 × egg (50 g each) on a per-100 g basis.
    expect(servingNutrients(egg100g, { basisMultiplier: 0.5 }, 2)).toEqual({
      energyKcal: 143,
      carbohydrateG: 0.7,
      proteinG: 12.6,
      fatG: 9.5,
    });
    const third = servingNutrients(
      { energyKcal: 100, carbohydrateG: 10, proteinG: 1, fatG: 1 },
      { basisMultiplier: 0.01 },
      33.3,
    );
    expect(third.energyKcal).toBeCloseTo(33.3, 12); // DATA-04: no rounding at compute time
  });

  it('DATA-06: keeps unknown macros unknown and known zeros zero', () => {
    const partial: Nutrients = { energyKcal: 50, carbohydrateG: null, proteinG: 0, fatG: null };
    expect(servingNutrients(partial, { basisMultiplier: 1 }, 3)).toEqual({
      energyKcal: 150,
      carbohydrateG: null,
      proteinG: 0,
      fatG: null,
    });
  });

  it('rejects servings without full conversion data', () => {
    expect(() => servingNutrients(egg100g, { basisMultiplier: 0 }, 1)).toThrow(RangeError);
    expect(() => servingNutrients(egg100g, { basisMultiplier: 1 }, 0)).toThrow(RangeError);
    expect(() => servingNutrients(egg100g, { basisMultiplier: Number.NaN }, 1)).toThrow(RangeError);
  });
});

describe('DATA-06: unknown-macro aggregation', () => {
  it('returns known sum + unknown count per macro', () => {
    const totals = sumNutrients([
      { energyKcal: 199, carbohydrateG: 1.4, proteinG: 25.2, fatG: 19 },
      { energyKcal: 300, carbohydrateG: null, proteinG: null, fatG: null }, // Quick Calories
      { energyKcal: 0, carbohydrateG: 0, proteinG: 0, fatG: 0 },
    ]);
    expect(totals.energyKcal).toBe(499);
    expect(totals.entryCount).toBe(3);
    expect(totals.carbohydrateG).toEqual({ knownSum: 1.4, unknownCount: 1 });
    expect(totals.proteinG).toEqual({ knownSum: 25.2, unknownCount: 1 });
    expect(totals.fatG).toEqual({ knownSum: 19, unknownCount: 1 });
  });

  it('an empty day is zero with nothing unknown', () => {
    expect(sumNutrients([])).toEqual({
      energyKcal: 0,
      entryCount: 0,
      carbohydrateG: { knownSum: 0, unknownCount: 0 },
      proteinG: { knownSum: 0, unknownCount: 0 },
      fatG: { knownSum: 0, unknownCount: 0 },
    });
  });

  it('combines meal totals into a day total without losing unknowns', () => {
    const breakfast = sumNutrients([{ energyKcal: 100, carbohydrateG: 10, proteinG: null, fatG: 1 }]);
    const lunch = sumNutrients([{ energyKcal: 200, carbohydrateG: null, proteinG: 5, fatG: 2 }]);
    const day = combineTotals([breakfast, lunch]);
    expect(day.energyKcal).toBe(300);
    expect(day.entryCount).toBe(2);
    expect(day.carbohydrateG).toEqual({ knownSum: 10, unknownCount: 1 });
    expect(day.proteinG).toEqual({ knownSum: 5, unknownCount: 1 });
  });
});
