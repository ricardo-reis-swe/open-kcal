import { duplicateMealName, isValidMealName, moveMeal } from '../meals';

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
});
