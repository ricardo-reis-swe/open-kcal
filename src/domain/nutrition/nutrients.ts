// Nutrition math (DATA-04/05/06, DATA-11, DATA-20). NULL = unknown, 0 = known zero: unknown is never coerced to 0.
import { scaleNutrientAmounts, type NutrientAmounts, type NutrientId } from './nutrientCatalog';

export type MacroKey = 'carbohydrateG' | 'proteinG' | 'fatG';
export const MACRO_KEYS: readonly MacroKey[] = ['carbohydrateG', 'proteinG', 'fatG'];

/** kcal is always known; a macro is `null` when unknown. */
export type Nutrients = {
  energyKcal: number;
  carbohydrateG: number | null;
  proteinG: number | null;
  fatG: number | null;
  /** DATA-20 catalog nutrients; present only when some are known (a missing key = unknown). */
  extra?: NutrientAmounts;
};

/** A known-sum + unknown-count pair for one macro across entries (DATA-06). */
export type MacroTotal = { knownSum: number; unknownCount: number };

export type NutrientTotals = {
  energyKcal: number;
  entryCount: number;
  carbohydrateG: MacroTotal;
  proteinG: MacroTotal;
  fatG: MacroTotal;
  /** DATA-20: per catalog nutrient, the known sum and how many entries know it; present only when some do. */
  extra?: Partial<Record<NutrientId, { knownSum: number; knownCount: number }>>;
};

/** DATA-20: a catalog nutrient's day/meal total as known sum + unknown count, like a macro. */
export function nutrientTotal(totals: NutrientTotals, id: NutrientId): MacroTotal {
  const known = totals.extra?.[id];
  return { knownSum: known?.knownSum ?? 0, unknownCount: totals.entryCount - (known?.knownCount ?? 0) };
}

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
  return scaleNutrients(basis, factor);
}

/** Every known value × factor (entry snapshots, DATA-16); unknowns stay unknown. */
export function scaleNutrients(nutrients: Nutrients, factor: number): Nutrients {
  const scaled: Nutrients = {
    energyKcal: nutrients.energyKcal * factor,
    carbohydrateG: scale(nutrients.carbohydrateG, factor),
    proteinG: scale(nutrients.proteinG, factor),
    fatG: scale(nutrients.fatG, factor),
  };
  if (nutrients.extra) scaled.extra = scaleNutrientAmounts(nutrients.extra, factor);
  return scaled;
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
  return combineTotals(
    entries.map((n) => {
      const one: NutrientTotals = {
        energyKcal: n.energyKcal,
        entryCount: 1,
        carbohydrateG: addMacro(EMPTY_TOTALS.carbohydrateG, n.carbohydrateG),
        proteinG: addMacro(EMPTY_TOTALS.proteinG, n.proteinG),
        fatG: addMacro(EMPTY_TOTALS.fatG, n.fatG),
      };
      const known = Object.entries(n.extra ?? {}) as [NutrientId, number][];
      if (known.length > 0)
        one.extra = Object.fromEntries(known.map(([id, v]) => [id, { knownSum: v, knownCount: 1 }]));
      return one;
    }),
  );
}

/** Combines per-meal totals into a day total without losing unknown counts. */
export function combineTotals(parts: readonly NutrientTotals[]): NutrientTotals {
  const merge = (a: MacroTotal, b: MacroTotal): MacroTotal => ({
    knownSum: a.knownSum + b.knownSum,
    unknownCount: a.unknownCount + b.unknownCount,
  });
  return parts.reduce<NutrientTotals>((acc, t) => {
    const next: NutrientTotals = {
      energyKcal: acc.energyKcal + t.energyKcal,
      entryCount: acc.entryCount + t.entryCount,
      carbohydrateG: merge(acc.carbohydrateG, t.carbohydrateG),
      proteinG: merge(acc.proteinG, t.proteinG),
      fatG: merge(acc.fatG, t.fatG),
    };
    if (acc.extra || t.extra) {
      const extra = { ...acc.extra };
      for (const [id, known] of Object.entries(t.extra ?? {}) as [
        NutrientId,
        { knownSum: number; knownCount: number },
      ][]) {
        const current = extra[id];
        extra[id] = current
          ? { knownSum: current.knownSum + known.knownSum, knownCount: current.knownCount + known.knownCount }
          : known;
      }
      next.extra = extra;
    }
    return next;
  }, EMPTY_TOTALS);
}
