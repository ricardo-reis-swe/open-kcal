import {
  DEFAULT_FOOD_SEARCH_SECTIONS,
  canHideFoodSearchSection,
  isValidFoodSearchSections,
  moveFoodSearchSection,
  parseFoodSearchSections,
  setFoodSearchSectionVisible,
  visibleFoodSearchSections,
  type FoodSearchSections,
} from '../searchSections';

const onlyUsda: FoodSearchSections = [
  { id: 'custom', visible: false },
  { id: 'saved', visible: false },
  { id: 'open_food_facts', visible: false },
  { id: 'usda', visible: true },
];

describe('DATA-19: Food Search sections', () => {
  it('defaults to My foods → Saved → Open Food Facts → USDA, all visible (the column default)', () => {
    expect(JSON.stringify(DEFAULT_FOOD_SEARCH_SECTIONS)).toBe(
      '[{"id":"custom","visible":true},{"id":"saved","visible":true},{"id":"open_food_facts","visible":true},{"id":"usda","visible":true}]',
    );
    expect(visibleFoodSearchSections(DEFAULT_FOOD_SEARCH_SECTIONS)).toEqual([
      'custom',
      'saved',
      'open_food_facts',
      'usda',
    ]);
  });

  it.each([
    ['not JSON', '{'],
    ['not a string', 42],
    ['missing', undefined],
    ['an unknown id', JSON.stringify([...onlyUsda.slice(0, 3), { id: 'fatsecret', visible: true }])],
    ['a duplicate id', JSON.stringify([...onlyUsda.slice(0, 3), { id: 'custom', visible: true }])],
    ['a missing id', JSON.stringify(onlyUsda.slice(1))],
    ['no visible section', JSON.stringify(onlyUsda.map((s) => ({ ...s, visible: false })))],
  ])('reads %s as the default', (_label, stored) => {
    expect(parseFoodSearchSections(stored)).toEqual(DEFAULT_FOOD_SEARCH_SECTIONS);
  });

  it('reads a valid order and visibility as stored', () => {
    const stored = [onlyUsda[3]!, ...onlyUsda.slice(0, 3)];
    expect(parseFoodSearchSections(JSON.stringify(stored))).toEqual(stored);
    expect(isValidFoodSearchSections(stored)).toBe(true);
    expect(visibleFoodSearchSections(stored)).toEqual(['usda']);
  });

  it('UX-18: the last visible section cannot be hidden', () => {
    expect(canHideFoodSearchSection(onlyUsda, 'usda')).toBe(false);
    expect(setFoodSearchSectionVisible(onlyUsda, 'usda', false)).toBeNull();
    expect(canHideFoodSearchSection(DEFAULT_FOOD_SEARCH_SECTIONS, 'usda')).toBe(true);
    expect(setFoodSearchSectionVisible(onlyUsda, 'saved', true)).toEqual([
      onlyUsda[0],
      { id: 'saved', visible: true },
      onlyUsda[2],
      onlyUsda[3],
    ]);
    expect(setFoodSearchSectionVisible(onlyUsda, 'usda', true)).toBeNull();
  });

  it('moves a section to a clamped index', () => {
    expect(moveFoodSearchSection(DEFAULT_FOOD_SEARCH_SECTIONS, 'usda', 0)?.map((s) => s.id)).toEqual([
      'usda',
      'custom',
      'saved',
      'open_food_facts',
    ]);
    expect(moveFoodSearchSection(DEFAULT_FOOD_SEARCH_SECTIONS, 'custom', 9)?.map((s) => s.id)).toEqual([
      'saved',
      'open_food_facts',
      'usda',
      'custom',
    ]);
    expect(moveFoodSearchSection(DEFAULT_FOOD_SEARCH_SECTIONS, 'custom', -1)).toBeNull();
  });
});
