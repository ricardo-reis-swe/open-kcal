import type { CustomFoodInput } from '@/data/db/repositories/foodsRepository';
import { createTestServices } from '@/shared/testing/services';

import { PARSER_VERSION as OFF_PARSER_VERSION } from '@/data/api/open-food-facts/mapper';
import { PARSER_VERSION as USDA_PARSER_VERSION } from '@/data/api/usda/mapper';

import { loadRecentFoods, refreshSavedFood } from '../food-search.queries';

const food = (name: string): CustomFoodInput => ({
  name,
  brand: null,
  basisQuantity: 100,
  basisUnit: 'g',
  nutrients: { energyKcal: 200, carbohydrateG: 20, proteinG: 10, fatG: 5 },
  servings: [{ label: 'g', quantity: 1, unit: 'g', basisMultiplier: 0.01, isDefault: true }],
});

describe('UX-04 / DATA-14: local Food Search queries', () => {
  it('hydrates recents newest-first with the food and servings', async () => {
    const { services, clock } = await createTestServices();
    const [breakfast] = await services.meals.list();
    const older = await services.foods.createCustom(food('Older food'));
    const newer = await services.foods.createCustom(food('Newer food'));
    await services.diary.addFoodEntry({
      diaryDate: '2026-09-25',
      mealId: breakfast!.id,
      foodId: older.id,
      servingId: older.servings[0]!.id,
      quantity: 50,
    });
    clock.advance(1_000);
    await services.diary.addFoodEntry({
      diaryDate: '2026-09-25',
      mealId: breakfast!.id,
      foodId: newer.id,
      servingId: newer.servings[0]!.id,
      quantity: 75,
    });

    const results = await loadRecentFoods(services);
    expect(results.map(({ food: result, lastServingQuantity }) => [result.name, lastServingQuantity])).toEqual([
      ['Newer food', 75],
      ['Older food', 50],
    ]);
    expect(results[0]!.food.servings[0]).toMatchObject({ label: 'g', isDefault: true });
  });

  it('respects the requested limit and excludes soft-deleted custom foods', async () => {
    const { services } = await createTestServices();
    const [breakfast] = await services.meals.list();
    for (const name of ['One', 'Two']) {
      const created = await services.foods.createCustom(food(name));
      await services.diary.addFoodEntry({
        diaryDate: '2026-09-25',
        mealId: breakfast!.id,
        foodId: created.id,
        servingId: created.servings[0]!.id,
        quantity: 1,
      });
      if (name === 'Two') await services.foods.deleteFood(created.id);
    }
    await expect(loadRecentFoods(services, 1)).resolves.toHaveLength(1);
    expect((await loadRecentFoods(services))[0]!.food.name).toBe('One');
  });
});

describe('PROV-09: saved-food refresh', () => {
  const cached = { fetchedAt: '2026-09-01T00:00:00.000Z', rawPayloadJson: null };
  const input = (extra?: CustomFoodInput['nutrients']['extra']): CustomFoodInput => ({
    ...food('Spinach'),
    nutrients: { ...food('Spinach').nutrients, extra },
  });

  it('refreshes an old-parser USDA food in the background so its nutrients arrive (PROV-14)', async () => {
    const { services } = await createTestServices();
    const saved = await services.foods.upsertExternal('usda', '5', input(), {
      ...cached,
      expiresAt: '2027-01-01T00:00:00.000Z',
      schemaVersion: 1,
    });
    jest.spyOn(services.usda, 'getFood').mockResolvedValue({ externalId: '5', input: input({ iron: 2.7 }) });
    await refreshSavedFood(services, saved);
    expect(services.usda.getFood).toHaveBeenCalledWith('5', expect.any(AbortSignal));
    const refreshed = await services.foods.get(saved.id);
    expect(refreshed.nutrients.extra).toEqual({ iron: 2.7 });
    expect(await services.foods.cacheMetadata(saved.id)).toMatchObject({ schemaVersion: USDA_PARSER_VERSION });
  });

  it('refreshes an old-parser OFF food too', async () => {
    const { services } = await createTestServices();
    const saved = await services.foods.upsertExternal('open_food_facts', '123', input(), {
      ...cached,
      expiresAt: '2027-01-01T00:00:00.000Z',
      schemaVersion: 1,
    });
    jest.spyOn(services.openFoodFacts, 'getFood').mockResolvedValue({ externalId: '123', input: input({ salt: 1 }) });
    await refreshSavedFood(services, saved);
    expect((await services.foods.get(saved.id)).nutrients.extra).toEqual({ salt: 1, sodium: 400 });
    expect(await services.foods.cacheMetadata(saved.id)).toMatchObject({ schemaVersion: OFF_PARSER_VERSION });
  });

  it('leaves fresh current-parser and custom foods alone', async () => {
    const { services } = await createTestServices();
    const fresh = await services.foods.upsertExternal('usda', '6', input(), {
      ...cached,
      expiresAt: '2027-01-01T00:00:00.000Z',
      schemaVersion: USDA_PARSER_VERSION,
    });
    const custom = await services.foods.createCustom(food('Mine'));
    const getFood = jest.spyOn(services.usda, 'getFood');
    await refreshSavedFood(services, fresh);
    await refreshSavedFood(services, custom);
    expect(getFood).not.toHaveBeenCalled();
  });
});
