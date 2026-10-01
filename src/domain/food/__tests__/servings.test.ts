import {
  adjustRulerQuantity,
  convertServingQuantity,
  initialServing,
  isMeasureLabel,
  rulerSpec,
  snapRulerQuantity,
  type ServingLike,
} from '../servings';

const servings: ServingLike[] = [
  { id: 'grams', label: 'g', unit: 'g', basisMultiplier: 0.01, isDefault: false },
  { id: 'ounces', label: 'oz', unit: 'oz', basisMultiplier: 28.349523125 / 100, isDefault: false },
  { id: 'egg', label: 'egg', unit: 'egg', basisMultiplier: 0.5, isDefault: true },
];

describe('UX-05 / DATA-11: serving selection and conversion', () => {
  it('uses the recent serving and quantity while both are valid', () => {
    expect(initialServing(servings, { servingId: 'grams', quantity: 75 })).toEqual({
      serving: servings[0],
      quantity: 75,
    });
  });

  it('falls back to one of the default count serving when the recent serving is gone', () => {
    expect(initialServing(servings, { servingId: 'deleted', quantity: 3 })).toEqual({
      serving: servings[2],
      quantity: 1,
    });
  });

  it('starts a measured default at the food basis amount', () => {
    expect(initialServing([{ ...servings[0]!, isDefault: true }], null)).toEqual({
      serving: { ...servings[0]!, isDefault: true },
      quantity: 100,
    });
    expect(initialServing([], null)).toBeNull();
  });

  it('keeps the represented amount when switching units', () => {
    expect(convertServingQuantity(100, servings[0]!, servings[1]!)).toBeCloseTo(3.527396195, 9);
    expect(convertServingQuantity(2, servings[2]!, servings[0]!)).toBe(100);
  });
});

describe('UX-05 / DS-09 / DS-11: ruler rules', () => {
  it.each([
    ['egg', 'egg', { step: 0.25, majorStep: 1 }],
    ['g', 'g', { step: 1, majorStep: 10 }],
    ['oz', 'oz', { step: 0.1, majorStep: 1 }],
    ['ml', 'ml', { step: 5, majorStep: 50 }],
    ['fl oz', 'fl oz', { step: 0.1, majorStep: 1 }],
  ] as const)('uses the required %s increments', (label, unit, expected) => {
    expect(rulerSpec({ label, unit })).toEqual(expected);
  });

  it('snaps to useful increments with a one-step minimum', () => {
    expect(snapRulerQuantity(2.13, servings[2]!)).toBe(2.25);
    expect(snapRulerQuantity(0, servings[2]!)).toBe(0.25);
    expect(snapRulerQuantity(13, { label: 'ml', unit: 'ml' })).toBe(15);
  });

  it('adjustable actions move one step and cannot decrement to zero', () => {
    expect(adjustRulerQuantity(2, 'increment', servings[2]!)).toBe(2.25);
    expect(adjustRulerQuantity(0.25, 'decrement', servings[2]!)).toBe(0.25);
    expect(adjustRulerQuantity(1.2, 'decrement', servings[1]!)).toBe(1.1);
  });
});

describe('DS-08 / DATA-27: measure labels', () => {
  it('reads g / oz / fl oz and recipe weights as measures, anything else as a count', () => {
    expect(['g', 'oz', 'fl oz', 'g cooked', 'oz raw', 'g cozinhado'].map(isMeasureLabel)).toEqual([
      true,
      true,
      true,
      true,
      true,
      true,
    ]);
    expect(['egg', 'serving', 'slice'].map(isMeasureLabel)).toEqual([false, false, false]);
  });
});
