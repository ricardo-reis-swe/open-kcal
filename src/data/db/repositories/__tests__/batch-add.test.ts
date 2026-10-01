import { NotFoundError, ValidationError } from '@/shared/errors';
import { openSeededTestDatabase } from '@/shared/testing/testDb';

import { createDiaryRepository, createRecentsRepository } from '../diaryRepository';
import { createFoodsRepository, type CustomFoodInput } from '../foodsRepository';
import { createMealsRepository } from '../mealsRepository';

const DAY = '2026-10-01';

const eggs: CustomFoodInput = {
  name: 'Eggs',
  brand: null,
  basisQuantity: 100,
  basisUnit: 'g',
  nutrients: { energyKcal: 150, carbohydrateG: 1, proteinG: 10, fatG: 11 },
  servings: [
    { label: 'g', quantity: 1, unit: 'g', basisMultiplier: 0.01 },
    { label: 'egg', quantity: 1, unit: 'egg', basisMultiplier: 0.5, isDefault: true },
  ],
};
const rice: CustomFoodInput = {
  name: 'Rice',
  brand: null,
  basisQuantity: 100,
  basisUnit: 'g',
  nutrients: { energyKcal: 130, carbohydrateG: 28, proteinG: 3, fatG: 0 },
  servings: [{ label: 'g', quantity: 1, unit: 'g', basisMultiplier: 0.01, isDefault: true }],
};

async function setup() {
  const deps = await openSeededTestDatabase();
  const meals = await createMealsRepository(deps).list();
  return {
    deps,
    foods: createFoodsRepository(deps),
    diary: createDiaryRepository(deps),
    recents: createRecentsRepository(deps),
    breakfast: meals[0]!.id,
    lunch: meals[1]!.id,
  };
}

describe('DATA-16 Add food entries (batch), UX-04 select mode', () => {
  it('logs each food in selection order with its last serving, else the UX-05 default', async () => {
    const { foods, diary, recents, breakfast, lunch } = await setup();
    const egg = await foods.createCustom(eggs);
    const grains = await foods.createCustom(rice);
    const gServing = egg.servings.find((s) => s.label === 'g')!;
    await diary.addFoodEntry({
      diaryDate: DAY,
      mealId: breakfast,
      foodId: egg.id,
      servingId: gServing.id,
      quantity: 80,
    });

    const added = await diary.addFoodEntries({ diaryDate: DAY, mealId: lunch, foodIds: [grains.id, egg.id] });

    expect(added.map((e) => [e.name, e.servingQuantity, e.servingUnit, e.mealId])).toEqual([
      ['Rice', 100, 'g', lunch], // never logged: default g serving at the basis quantity
      ['Eggs', 80, 'g', lunch], // last serving
    ]);
    expect(added.map((e) => e.sortOrder)).toEqual([0, 1]);
    expect(added[0]!.nutrients.energyKcal).toBeCloseTo(130);
    const day = await diary.loadDay(DAY);
    expect(day.meals.find((m) => m.meal.id === lunch)!.entries).toHaveLength(2);
    expect((await recents.get(grains.id))!.lastServingQuantity).toBe(100);
    expect((await recents.get(egg.id))!.useCount).toBe(2);
  });

  it('appends after existing entries and skips foods soft-deleted since selection', async () => {
    const { foods, diary, lunch } = await setup();
    const egg = await foods.createCustom(eggs);
    const grains = await foods.createCustom(rice);
    await diary.addFoodEntries({ diaryDate: DAY, mealId: lunch, foodIds: [egg.id] });
    await foods.deleteFood(egg.id);

    const added = await diary.addFoodEntries({ diaryDate: DAY, mealId: lunch, foodIds: [egg.id, grains.id] });

    expect(added.map((e) => [e.name, e.sortOrder])).toEqual([['Rice', 1]]);
  });

  it('rolls back every entry when one food fails', async () => {
    const { deps, foods, diary, lunch } = await setup();
    const egg = await foods.createCustom(eggs);
    const broken = await foods.createCustom(rice);
    await deps.db.run('DELETE FROM food_servings WHERE food_id = ?', [broken.id]);

    await expect(
      diary.addFoodEntries({ diaryDate: DAY, mealId: lunch, foodIds: [egg.id, broken.id] }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(diary.addFoodEntries({ diaryDate: DAY, mealId: 'nope', foodIds: [egg.id] })).rejects.toBeInstanceOf(
      NotFoundError,
    );

    const day = await diary.loadDay(DAY);
    expect(day.meals.flatMap((m) => m.entries)).toHaveLength(0);
  });
});
