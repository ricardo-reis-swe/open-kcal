import type { CustomFoodInput } from '@/data/db/repositories/foodsRepository';
import { createTestServices } from '@/shared/testing/services';

import { loadRecentFoods } from '../food-search.queries';

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
