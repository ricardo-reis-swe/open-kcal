import { parseRouteParams, routes } from '../routes';

describe('ARCH-03 / NAV-04 / NAV-09: food route contracts', () => {
  it('validates Food Search while preserving its query and origin', () => {
    expect(
      parseRouteParams('foodSearch', {
        mealId: 'lunch',
        date: '2026-09-25',
        initialQuery: 'oats',
        origin: 'profile',
      }),
    ).toEqual({ mealId: 'lunch', date: '2026-09-25', initialQuery: 'oats', scan: false, origin: 'profile' });
  });

  it('validates Food Detail using IDs and lightweight context only', () => {
    const params = {
      foodId: 'food-1',
      foodSource: 'custom' as const,
      mealId: 'lunch',
      date: '2026-09-25',
    };
    expect(parseRouteParams('foodDetail', params)).toEqual({ ...params, origin: 'diary' });
  });

  it('carries an external ID so a remote result can open Food Detail before its detail read', () => {
    const params = {
      foodId: '12345',
      externalId: '12345',
      foodSource: 'usda' as const,
      mealId: 'lunch',
      date: '2026-09-25',
    };
    expect(parseRouteParams('foodDetail', params)).toEqual({ ...params, origin: 'diary' });
    expect(routes.foodDetail(params)).toEqual({
      pathname: '/diary/food-detail/[foodId]',
      params: { ...params, origin: 'diary' },
    });
  });

  it('validates Create Custom Food with the search text as the initial name', () => {
    const params = { mealId: 'lunch', date: '2026-09-25', initialName: 'Almond oats' };
    expect(parseRouteParams('createCustomFood', params)).toEqual({ ...params, origin: 'diary' });
  });

  it('NAV-04: validates and builds Edit Food Entry with ID + origin only', () => {
    expect(parseRouteParams('editFoodEntry', { entryId: 'entry-1', origin: 'profile' })).toEqual({
      entryId: 'entry-1',
      origin: 'profile',
    });
    expect(routes.editFoodEntry({ entryId: 'entry-1', origin: 'diary' })).toEqual({
      pathname: '/diary/food-entry/[entryId]',
      params: { entryId: 'entry-1', origin: 'diary' },
    });
  });

  it.each([
    ['foodSearch', { mealId: '', date: '2026-09-25' }],
    ['foodDetail', { foodId: 'f', foodSource: 'other', mealId: 'm', date: '2026-09-25' }],
    ['createCustomFood', { mealId: 'm', date: '2026-02-30' }],
    ['editFoodEntry', { entryId: '' }],
  ] as const)('rejects invalid %s params', (route, params) => {
    expect(parseRouteParams(route, params)).toBeNull();
  });
});
