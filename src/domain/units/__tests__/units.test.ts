import {
  defaultUnitPreferences,
  energyFromKcal,
  energyToKcal,
  foodWeightFromG,
  foodWeightToG,
  volumeFromMl,
  volumeToMl,
  weightFromKg,
  weightToKg,
} from '../units';

describe('DATA-04: unit conversion', () => {
  it('uses the exact constants', () => {
    expect(weightToKg(1, 'lb')).toBe(0.45359237);
    expect(foodWeightToG(1, 'oz')).toBe(28.349523125);
    expect(volumeToMl(1, 'fl_oz')).toBe(29.5735295625);
    expect(energyFromKcal(1, 'kJ')).toBe(4.184);
  });

  it('is identity for canonical units', () => {
    expect(weightFromKg(72.35, 'kg')).toBe(72.35);
    expect(foodWeightFromG(12.5, 'g')).toBe(12.5);
    expect(volumeFromMl(240, 'ml')).toBe(240);
    expect(energyToKcal(1731, 'kcal')).toBe(1731);
  });

  it('round-trips at full precision (no display rounding)', () => {
    for (const v of [0.1, 1, 72.35, 180.4]) {
      expect(weightToKg(weightFromKg(v, 'lb'), 'lb')).toBeCloseTo(v, 12);
      expect(foodWeightToG(foodWeightFromG(v, 'oz'), 'oz')).toBeCloseTo(v, 12);
      expect(volumeToMl(volumeFromMl(v, 'fl_oz'), 'fl_oz')).toBeCloseTo(v, 12);
      expect(energyToKcal(energyFromKcal(v, 'kJ'), 'kJ')).toBeCloseTo(v, 12);
    }
    expect(weightFromKg(100, 'lb')).toBeCloseTo(220.462262185, 9);
  });
});

describe('DATA-17: locale-informed unit defaults', () => {
  it('uses US customary units only for the US measurement system', () => {
    expect(defaultUnitPreferences('us')).toEqual({
      weightUnit: 'lb',
      foodWeightUnit: 'oz',
      energyUnit: 'kcal',
      volumeUnit: 'fl_oz',
    });
  });

  it.each(['metric', 'uk', null, undefined, 'unexpected'])('falls back to metric for %p', (system) => {
    expect(defaultUnitPreferences(system)).toEqual({
      weightUnit: 'kg',
      foodWeightUnit: 'g',
      energyUnit: 'kcal',
      volumeUnit: 'ml',
    });
  });
});
