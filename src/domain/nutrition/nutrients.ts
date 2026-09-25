// Nutrition math (DATA-04/05/06, DATA-11). NULL = unknown, 0 = known zero: unknown is never coerced to 0.

export type MacroKey = 'carbohydrateG' | 'proteinG' | 'fatG';
export const MACRO_KEYS: readonly MacroKey[] = ['carbohydrateG', 'proteinG', 'fatG'];

/** kcal is always known; a macro is `null` when unknown. */
export type Nutrients = {
  energyKcal: number;
  carbohydrateG: number | null;
  proteinG: number | null;
  fatG: number | null;
};

/** A known-sum + unknown-count pair for one macro across entries (DATA-06). */
export type MacroTotal = { knownSum: number; unknownCount: number };

export type NutrientTotals = {
  energyKcal: number;
  entryCount: number;
  carbohydrateG: MacroTotal;
  proteinG: MacroTotal;
  fatG: MacroTotal;
};

/** A selectable serving: full conversion data to the food's nutrition basis (DATA-11). */
export type ServingConversion = { basisMultiplier: number };

const scale = (value: number | null, factor: number): number | null => (value === null ? null : value * factor);

/**
 * Entry nutrition, unrounded (DATA-04): `nutrient = basis nutrient × basis_multiplier × ruler value` (DATA-11).
 * The result is what gets snapshotted onto the entry (DATA-05).
 */
export function servingNutrients(basis: Nutrients, serving: ServingConversion, quantity: number): Nutrients {
  if (!(serving.basisMultiplier > 0)) throw new RangeError('basisMultiplier must be > 0');
  if (!(quantity > 0)) throw new RangeError('quantity must be > 0');
  const factor = serving.basisMultiplier * quantity;
  return {
    energyKcal: basis.energyKcal * factor,
    carbohydrateG: scale(basis.carbohydrateG, factor),
    proteinG: scale(basis.proteinG, factor),
    fatG: scale(basis.fatG, factor),
  };
}

export const EMPTY_TOTALS: NutrientTotals = {
  energyKcal: 0,
  entryCount: 0,
  carbohydrateG: { knownSum: 0, unknownCount: 0 },
  proteinG: { knownSum: 0, unknownCount: 0 },
  fatG: { knownSum: 0, unknownCount: 0 },
};

function addMacro(total: MacroTotal, value: number | null): MacroTotal {
  return value === null
    ? { knownSum: total.knownSum, unknownCount: total.unknownCount + 1 }
    : { knownSum: total.knownSum + value, unknownCount: total.unknownCount };
}

/** Sums snapshots at full precision (DATA-04: round once, for display). */
export function sumNutrients(entries: readonly Nutrients[]): NutrientTotals {
  return entries.reduce<NutrientTotals>(
    (acc, n) => ({
      energyKcal: acc.energyKcal + n.energyKcal,
      entryCount: acc.entryCount + 1,
      carbohydrateG: addMacro(acc.carbohydrateG, n.carbohydrateG),
      proteinG: addMacro(acc.proteinG, n.proteinG),
      fatG: addMacro(acc.fatG, n.fatG),
    }),
    EMPTY_TOTALS,
  );
}

/** Combines per-meal totals into a day total without losing unknown counts. */
export function combineTotals(parts: readonly NutrientTotals[]): NutrientTotals {
  const merge = (a: MacroTotal, b: MacroTotal): MacroTotal => ({
    knownSum: a.knownSum + b.knownSum,
    unknownCount: a.unknownCount + b.unknownCount,
  });
  return parts.reduce<NutrientTotals>(
    (acc, t) => ({
      energyKcal: acc.energyKcal + t.energyKcal,
      entryCount: acc.entryCount + t.entryCount,
      carbohydrateG: merge(acc.carbohydrateG, t.carbohydrateG),
      proteinG: merge(acc.proteinG, t.proteinG),
      fatG: merge(acc.fatG, t.fatG),
    }),
    EMPTY_TOTALS,
  );
}
