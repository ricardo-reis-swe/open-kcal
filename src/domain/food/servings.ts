// Pure serving-selection and ruler rules (DATA-11, UX-05).

export type ServingLike = {
  id: string;
  label: string;
  unit: string;
  basisMultiplier: number;
  isDefault: boolean;
};

export type RecentServing = { servingId: string | null; quantity: number | null } | null;

export type RulerSpec = { step: number; majorStep: number };

const G_SPEC: RulerSpec = { step: 1, majorStep: 10 };
const OZ_SPEC: RulerSpec = { step: 0.1, majorStep: 1 };

const RULER_SPECS: Readonly<Record<string, RulerSpec>> = {
  g: G_SPEC,
  oz: OZ_SPEC,
  ml: { step: 5, majorStep: 50 },
  fl_oz: { step: 0.1, majorStep: 1 },
  // DATA-27 recipe weights ruler like plain g / oz.
  g_cooked: G_SPEC,
  g_raw: G_SPEC,
  oz_cooked: OZ_SPEC,
  oz_raw: OZ_SPEC,
};

function normalizedUnit(serving: Pick<ServingLike, 'label' | 'unit'>): string {
  const value = (serving.unit || serving.label).trim().toLowerCase();
  return value === 'fl oz' ? 'fl_oz' : value;
}

/** UX-05: count 0.25/1; mass and volume units use their specified snap/major intervals. */
export function rulerSpec(serving: Pick<ServingLike, 'label' | 'unit'>): RulerSpec {
  return RULER_SPECS[normalizedUnit(serving)] ?? { step: 0.25, majorStep: 1 };
}

/**
 * UX-05 initial value: a still-valid recent choice wins. Otherwise use the default serving; measured servings show
 * the food's basis amount (the quantity whose multiplier is 1), while count servings start at 1.
 */
export function initialServing(
  servings: readonly ServingLike[],
  recent: RecentServing,
): { serving: ServingLike; quantity: number } | null {
  if (servings.length === 0) return null;
  const recentServing = recent?.servingId ? servings.find((serving) => serving.id === recent.servingId) : undefined;
  if (recentServing && recent && recent.quantity !== null && Number.isFinite(recent.quantity) && recent.quantity > 0) {
    return { serving: recentServing, quantity: recent.quantity };
  }

  const serving = servings.find((candidate) => candidate.isDefault) ?? servings[0]!;
  const measured = normalizedUnit(serving) in RULER_SPECS;
  const basisQuantity = serving.basisMultiplier > 0 ? 1 / serving.basisMultiplier : 1;
  return { serving, quantity: measured ? basisQuantity : 1 };
}

/** UX-05: changing a fully-convertible serving preserves the represented amount of food. */
export function convertServingQuantity(quantity: number, from: ServingLike, to: ServingLike): number {
  if (!(Number.isFinite(quantity) && quantity > 0 && from.basisMultiplier > 0 && to.basisMultiplier > 0)) return 1;
  return (quantity * from.basisMultiplier) / to.basisMultiplier;
}

/** UX-05 / DS-09: snap to the unit's useful increment and never allow zero. */
export function snapRulerQuantity(quantity: number, serving: Pick<ServingLike, 'label' | 'unit'>): number {
  const { step } = rulerSpec(serving);
  if (!Number.isFinite(quantity)) return step;
  const snapped = Math.round(quantity / step) * step;
  // Avoid binary-float tails in values rendered by the ruler.
  return Number(Math.max(step, snapped).toFixed(10));
}

/** DS-11: adjustable increment/decrement moves exactly one snap step. */
export function adjustRulerQuantity(
  quantity: number,
  direction: 'increment' | 'decrement',
  serving: Pick<ServingLike, 'label' | 'unit'>,
): number {
  const { step } = rulerSpec(serving);
  return snapRulerQuantity(quantity + (direction === 'increment' ? step : -step), serving);
}
