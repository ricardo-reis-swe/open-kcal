import { isValidQuickCaloriesKcal, nextSortOrder, normalizeNote } from '../entries';

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
