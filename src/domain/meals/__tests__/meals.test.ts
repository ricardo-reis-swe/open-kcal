import { dragShift, dropIndex, duplicateMealName, isValidMealName, moveMeal, moveMealToIndex } from '../meals';

describe('UX-17: meal helpers', () => {
  const meals = [
    { id: 'a', name: 'Breakfast' },
    { id: 'b', name: 'Lunch' },
  ];

  it('warns about duplicate names (trimmed, case-insensitive), ignoring the meal being edited', () => {
    expect(duplicateMealName(meals, ' lunch ')).toBe('Lunch');
    expect(duplicateMealName(meals, 'Lunch', 'b')).toBeNull();
    expect(duplicateMealName(meals, 'Supper')).toBeNull();
    expect(duplicateMealName(meals, '  ')).toBeNull();
  });

  it('validates 1–40 characters after trim', () => {
    expect(isValidMealName('  ')).toBe(false);
    expect(isValidMealName(` ${'x'.repeat(40)} `)).toBe(true);
    expect(isValidMealName('x'.repeat(41))).toBe(false);
  });

  it('moves a meal up or down for the a11y actions', () => {
    expect(moveMeal(['a', 'b', 'c'], 'c', -1)).toEqual(['a', 'c', 'b']);
    expect(moveMeal(['a', 'b', 'c'], 'a', 1)).toEqual(['b', 'a', 'c']);
    expect(moveMeal(['a', 'b', 'c'], 'a', -1)).toBeNull();
    expect(moveMeal(['a', 'b', 'c'], 'c', 1)).toBeNull();
    expect(moveMeal(['a'], 'x', 1)).toBeNull();
  });

  it('UX-17 drag: drops on the nearest row (clamped) and moves the ID there', () => {
    expect(dropIndex(0, 110, 52, 4)).toBe(2);
    expect(dropIndex(3, -20, 52, 4)).toBe(3);
    expect(dropIndex(1, -500, 52, 4)).toBe(0);
    expect(dropIndex(1, 500, 52, 4)).toBe(3);
    expect(moveMealToIndex(['a', 'b', 'c'], 'a', 2)).toEqual(['b', 'c', 'a']);
    expect(moveMealToIndex(['a', 'b', 'c'], 'c', 0)).toEqual(['c', 'a', 'b']);
    expect(moveMealToIndex(['a', 'b', 'c'], 'b', 1)).toBeNull();
    expect(moveMealToIndex(['a', 'b', 'c'], 'x', 1)).toBeNull();
  });

  it('UX-17 drag preview: rows between the dragged row and the hovered slot shift one row toward it', () => {
    const shifts = (from: number, hover: number) => [0, 1, 2, 3].map((i) => dragShift(i, from, hover, 50));
    expect(shifts(-1, 2)).toEqual([0, 0, 0, 0]);
    expect(shifts(1, 1)).toEqual([0, 0, 0, 0]);
    expect(shifts(0, 3)).toEqual([0, -50, -50, -50]);
    expect(shifts(0, 1)).toEqual([0, -50, 0, 0]);
    expect(shifts(3, 0)).toEqual([50, 50, 50, 0]);
    expect(shifts(2, 1)).toEqual([0, 50, 0, 0]);
  });
});
