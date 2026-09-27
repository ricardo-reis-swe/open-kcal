// ROAD-01 M2: dev-only sample diary data for display and QA. Runs only in `__DEV__` builds with
// EXPO_PUBLIC_DEV_SEED_DIARY=1, and only once (keyed on its marker food). Never part of the DATA-17 seed.
import { addDays, nowUtcIso, type LocalDate } from '@/shared/dates';

import type { AppServices } from './services';

const MARKER = 'Scrambled eggs (sample)';

export async function seedDevDiary(services: AppServices, today: LocalDate): Promise<boolean> {
  const exists = await services.db.getFirst<{ ok: number }>(
    "SELECT 1 AS ok FROM foods WHERE source = 'custom' AND name = ?",
    [MARKER],
  );
  if (exists) return false;
  const [breakfast, lunch, dinner, snacks] = await services.meals.list();
  if (!breakfast || !lunch || !dinner || !snacks) return false;

  const eggs = await services.foods.createCustom({
    name: MARKER,
    basisQuantity: 100,
    basisUnit: 'g',
    nutrients: { energyKcal: 149, carbohydrateG: 1.6, proteinG: 10, fatG: 11 },
    servings: [
      { label: 'g', quantity: 1, unit: 'g', basisMultiplier: 0.01 },
      { label: 'egg', quantity: 1, unit: 'egg', basisMultiplier: 0.67, isDefault: true },
    ],
  });
  const toast = await services.foods.createCustom({
    name: 'Wholegrain toast with butter and a long descriptive name (sample)',
    basisQuantity: 100,
    basisUnit: 'g',
    nutrients: { energyKcal: 290, carbohydrateG: 41, proteinG: 11, fatG: 9 },
    servings: [{ label: 'slice', quantity: 1, unit: 'slice', basisMultiplier: 0.35, isDefault: true }],
  });
  const yoghurt = await services.foods.createCustom({
    name: 'Greek yoghurt (sample)',
    basisQuantity: 100,
    basisUnit: 'g',
    nutrients: { energyKcal: 97, carbohydrateG: 3.9, proteinG: 9, fatG: 5 },
    servings: [{ label: 'g', quantity: 1, unit: 'g', basisMultiplier: 0.01, isDefault: true }],
  });
  // ARCH-18 / ROAD-02 M5: deterministic cached OFF food for the Android offline flow. It is inserted directly
  // through the repository, never fetched from a provider, and remains local data like a real selected OFF food.
  await services.foods.upsertExternal(
    'open_food_facts',
    'e2e-offline-oat-bar',
    {
      name: 'E2E Offline Oat Bar',
      brand: 'Local test fixture',
      basisQuantity: 100,
      basisUnit: 'g',
      nutrients: { energyKcal: 380, carbohydrateG: 58, proteinG: 9, fatG: 12 },
      servings: [
        { label: 'g', quantity: 1, unit: 'g', basisMultiplier: 0.01 },
        { label: 'bar', quantity: 1, unit: 'bar', basisMultiplier: 0.12, isDefault: true },
      ],
    },
    {
      fetchedAt: nowUtcIso(services.clock),
      expiresAt: '9999-12-31T23:59:59.999Z',
      rawPayloadJson: null,
      schemaVersion: 1,
    },
  );
  const serving = (food: typeof eggs, label: string) => food.servings.find((s) => s.label === label)!.id;
  const addFood = (date: LocalDate, mealId: string, food: typeof eggs, label: string, quantity: number) =>
    services.diary.addFoodEntry({
      diaryDate: date,
      mealId,
      foodId: food.id,
      servingId: serving(food, label),
      quantity,
    });

  // Today: typical day with a partial (unknown) macro total from Quick Calories.
  await addFood(today, breakfast.id, eggs, 'egg', 2);
  await addFood(today, breakfast.id, toast, 'slice', 1);
  await services.diary.addQuickCalories({ diaryDate: today, mealId: lunch.id, energyKcal: 650, note: 'Canteen lunch' });
  await addFood(today, snacks.id, yoghurt, 'g', 150);
  await services.diary.addQuickCalories({ diaryDate: today, mealId: snacks.id, energyKcal: 120 });
  // Tomorrow: over goal. (A future day, because days before the first launch have no goal, DATA-09.)
  const tomorrow = addDays(today, 1);
  await addFood(tomorrow, breakfast.id, toast, 'slice', 3);
  await services.diary.addQuickCalories({
    diaryDate: tomorrow,
    mealId: dinner.id,
    energyKcal: 2100,
    note: 'Birthday dinner',
  });
  // Yesterday: known macros only. Two or more days ahead stay empty (every meal still shows).
  await addFood(addDays(today, -1), lunch.id, eggs, 'g', 200);
  return true;
}

const FOOD_SEARCH_MARKER = 'Offline E2E custom oats';

/** ARCH-18 / ROAD-02 M5: local-only data for the Android offline Maestro flow; never a DATA-17 default. */
export async function seedDevFoodSearch(services: AppServices): Promise<boolean> {
  const exists = await services.db.getFirst<{ ok: number }>(
    "SELECT 1 AS ok FROM foods WHERE source = 'custom' AND name = ?",
    [FOOD_SEARCH_MARKER],
  );
  if (exists) return false;
  await services.foods.createCustom({
    name: FOOD_SEARCH_MARKER,
    basisQuantity: 100,
    basisUnit: 'g',
    nutrients: { energyKcal: 372, carbohydrateG: 60, proteinG: 13, fatG: 7 },
    servings: [{ label: 'g', quantity: 1, unit: 'g', basisMultiplier: 0.01, isDefault: true }],
  });
  await services.foods.upsertExternal(
    'open_food_facts',
    'm5-offline-e2e-yoghurt',
    {
      name: 'Offline E2E saved yoghurt',
      brand: 'Maestro',
      basisQuantity: 100,
      basisUnit: 'g',
      nutrients: { energyKcal: 95, carbohydrateG: 4, proteinG: 8, fatG: 5 },
      servings: [
        { label: 'g', quantity: 1, unit: 'g', basisMultiplier: 0.01 },
        { label: 'egg', quantity: 1, unit: 'egg', basisMultiplier: 0.5, isDefault: true },
      ],
    },
    {
      fetchedAt: '2026-01-01T00:00:00.000Z',
      expiresAt: '2026-01-02T00:00:00.000Z',
      rawPayloadJson: null,
      schemaVersion: 1,
    },
  );
  return true;
}
