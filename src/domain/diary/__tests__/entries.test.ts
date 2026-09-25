import {
  isValidQuickCaloriesKcal,
  nextSortOrder,
  normalizeNote,
  parseQuickCaloriesInput,
  quickCaloriesRange,
} from '../entries';

describe('DATA-06 / DATA-16: diary entry rules', () => {
  it('trims the Quick Calories note; empty → null', () => {
    expect(normalizeNote('  coffee  ')).toBe('coffee');
    expect(normalizeNote('   ')).toBeNull();
    expect(normalizeNote('')).toBeNull();
    expect(normalizeNote(null)).toBeNull();
    expect(normalizeNote(undefined)).toBeNull();
  });

  it('accepts kcal ≥ 0 at the data layer', () => {
    expect(isValidQuickCaloriesKcal(0)).toBe(true);
    expect(isValidQuickCaloriesKcal(350.5)).toBe(true);
    expect(isValidQuickCaloriesKcal(-1)).toBe(false);
    expect(isValidQuickCaloriesKcal(Number.NaN)).toBe(false);
    expect(isValidQuickCaloriesKcal(Number.POSITIVE_INFINITY)).toBe(false);
  });

  it('appends after the highest sort_order', () => {
    expect(nextSortOrder([])).toBe(0);
    expect(nextSortOrder([{ sortOrder: 0 }, { sortOrder: 4 }, { sortOrder: 2 }])).toBe(5);
  });
});

describe('UX-00 / UX-07: Quick Calories input', () => {
  it('UX-00: the range is 1–10,000 kcal, shown in the energy unit', () => {
    expect(quickCaloriesRange('kcal')).toEqual({ min: 1, max: 10_000 });
    expect(quickCaloriesRange('kJ')).toEqual({ min: 5, max: 41_840 });
  });

  it.each([
    ['450', 'kcal', 450],
    [' 1 ', 'kcal', 1],
    ['10000', 'kcal', 10_000],
    ['41840', 'kJ', 10_000],
    ['5', 'kJ', 5 / 4.184],
  ] as const)('UX-07: %s %s parses to canonical kcal', (text, unit, kcal) => {
    expect(parseQuickCaloriesInput(text, unit)).toBeCloseTo(kcal, 9);
  });

  it.each([
    ['', 'kcal'],
    ['0', 'kcal'],
    ['10001', 'kcal'],
    ['12.5', 'kcal'],
    ['1,5', 'kcal'],
    ['-3', 'kcal'],
    ['4', 'kJ'],
    ['41841', 'kJ'],
  ] as const)('UX-07: %s %s is rejected', (text, unit) => {
    expect(parseQuickCaloriesInput(text, unit)).toBeNull();
  });
});
