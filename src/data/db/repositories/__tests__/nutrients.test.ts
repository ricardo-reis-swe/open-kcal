import { DEFAULT_DASHBOARD_NUTRIENTS, setDashboardNutrientVisible } from '@/domain/nutrition/dashboardNutrients';
import { NUTRIENT_IDS } from '@/domain/nutrition/nutrientCatalog';
import { nutrientTotal } from '@/domain/nutrition/nutrients';
import { openSeededTestDatabase } from '@/shared/testing/testDb';

import { createDiaryRepository } from '../diaryRepository';
import { createFoodsRepository, type CustomFoodInput, type FoodInput } from '../foodsRepository';
import { createMealsRepository } from '../mealsRepository';
import { createSettingsRepository } from '../settingsRepository';

const DAY = '2026-09-25';

const oats: CustomFoodInput = {
  name: 'Oats',
  basisQuantity: 100,
  basisUnit: 'g',
  nutrients: {
    energyKcal: 380,
    carbohydrateG: 60,
    proteinG: 13,
    fatG: 7,
    extra: { fibre: 10, salt: 0.05, iron: 4 },
  },
  servings: [{ label: 'g', quantity: 1, unit: 'g', basisMultiplier: 0.01, isDefault: true }],
};

const offBar = (extra: FoodInput['nutrients']['extra']): FoodInput => ({
  name: 'Barra de cereais',
  basisQuantity: 100,
  basisUnit: 'g',
  nutrients: { energyKcal: 400, carbohydrateG: 60, proteinG: null, fatG: null, extra },
  servings: [{ label: 'bar', quantity: 1, unit: 'bar', basisMultiplier: 0.25 }],
});
const cache = {
  fetchedAt: '2026-09-25T10:00:00.000Z',
  expiresAt: '2027-01-01T00:00:00.000Z',
  rawPayloadJson: null,
  schemaVersion: 1,
};

async function setup() {
  const deps = await openSeededTestDatabase();
  const meals = await createMealsRepository(deps).list();
  return {
    deps,
    foods: createFoodsRepository(deps),
    diary: createDiaryRepository(deps),
    settings: createSettingsRepository(deps),
    breakfast: meals[0]!.id,
    lunch: meals[1]!.id,
  };
}

describe('DATA-20: catalog nutrients on foods', () => {
  it('stores custom-food nutrients and completes sodium from salt', async () => {
    const { foods } = await setup();
    const food = await foods.createCustom(oats);
    expect(food.nutrients.extra).toEqual({ fibre: 10, salt: 0.05, sodium: 20, iron: 4 });
    expect((await foods.get(food.id)).nutrients.extra).toEqual(food.nutrients.extra);
  });

  it('keeps foods without catalog nutrients free of an `extra` key', async () => {
    const { foods } = await setup();
    const food = await foods.createCustom({ ...oats, nutrients: { ...oats.nutrients, extra: undefined } });
    expect(food.nutrients).toEqual({ energyKcal: 380, carbohydrateG: 60, proteinG: 13, fatG: 7 });
  });

  it('rejects unknown ids and negative or non-finite amounts', async () => {
    const { foods } = await setup();
    for (const extra of [{ fibre: -1 }, { fibre: Number.NaN }, { alcohol: 5 } as never]) {
      await expect(foods.createCustom({ ...oats, nutrients: { ...oats.nutrients, extra } })).rejects.toMatchObject({
        category: 'validation',
      });
    }
  });

  it('an external refresh replaces the rows; a nutrient missing from it becomes unknown', async () => {
    const { foods } = await setup();
    const first = await foods.upsertExternal('open_food_facts', '1', offBar({ fibre: 5, sodium: 400 }), cache);
    expect(first.nutrients.extra).toEqual({ fibre: 5, sodium: 400, salt: 1 });
    const again = await foods.upsertExternal('open_food_facts', '1', offBar({ sugars: 20 }), cache);
    expect(again.id).toBe(first.id);
    expect(again.nutrients.extra).toEqual({ sugars: 20 });
  });
});

describe('DATA-20 / DATA-05: entry nutrient snapshots and day totals', () => {
  it('snapshots scaled nutrients; history ignores later food changes', async () => {
    const { foods, diary, breakfast } = await setup();
    const food = await foods.upsertExternal('usda', '9', offBar({ fibre: 8, vitamin_c: 12 }), cache);
    const entry = await diary.addFoodEntry({
      diaryDate: DAY,
      mealId: breakfast,
      foodId: food.id,
      servingId: food.servings[0]!.id,
      quantity: 2,
    });
    // 2 bars × 0.25 × per-100 g values.
    expect(entry.nutrients.extra).toEqual({ fibre: 4, vitamin_c: 6 });
    await foods.upsertExternal('usda', '9', offBar({ fibre: 100 }), cache);
    expect((await diary.getEntry(entry.id)).nutrients.extra).toEqual({ fibre: 4, vitamin_c: 6 });
  });

  it('day and meal totals are known sum + unknown count per nutrient, Quick Calories unknown', async () => {
    const { foods, diary, breakfast, lunch } = await setup();
    const food = await foods.createCustom(oats);
    const add = (mealId: string, quantity: number) =>
      diary.addFoodEntry({ diaryDate: DAY, mealId, foodId: food.id, servingId: food.servings[0]!.id, quantity });
    await add(breakfast, 50);
    await add(lunch, 100);
    await diary.addQuickCalories({ diaryDate: DAY, mealId: lunch, energyKcal: 300 });
    const day = await diary.loadDay(DAY);
    expect(nutrientTotal(day.totals, 'fibre')).toEqual({ knownSum: 15, unknownCount: 1 });
    expect(nutrientTotal(day.meals[0]!.totals, 'fibre')).toEqual({ knownSum: 5, unknownCount: 0 });
    expect(nutrientTotal(day.meals[1]!.totals, 'fibre')).toEqual({ knownSum: 10, unknownCount: 1 });
    // A nutrient no entry knows: every entry is unknown.
    expect(nutrientTotal(day.totals, 'caffeine')).toEqual({ knownSum: 0, unknownCount: 3 });
    expect(day.meals[0]!.entries[0]!.nutrients.extra).toMatchObject({ fibre: 5, iron: 2 });
  });

  it('edit scales the snapshot with the quantity and recomputes it on a serving change', async () => {
    const { foods, diary, breakfast } = await setup();
    const food = await foods.createCustom({
      ...oats,
      servings: [...oats.servings, { label: 'cup', quantity: 1, unit: 'cup', basisMultiplier: 0.8 }],
    });
    const entry = await diary.addFoodEntry({
      diaryDate: DAY,
      mealId: breakfast,
      foodId: food.id,
      servingId: food.servings[0]!.id,
      quantity: 50,
    });
    const scaled = await diary.editFoodEntry(entry.id, { mealId: breakfast, quantity: 100 });
    expect(scaled.nutrients.extra).toMatchObject({ fibre: 10, iron: 4 });
    const cup = await diary.editFoodEntry(entry.id, {
      mealId: breakfast,
      quantity: 1,
      servingId: food.servings[1]!.id,
    });
    expect(cup.nutrients.extra).toMatchObject({ fibre: 8, iron: 3.2 });
  });

  it('copies carry the snapshot; Undo restores it; delete removes it', async () => {
    const { deps, foods, diary, breakfast, lunch } = await setup();
    const food = await foods.createCustom(oats);
    const entry = await diary.addFoodEntry({
      diaryDate: DAY,
      mealId: breakfast,
      foodId: food.id,
      servingId: food.servings[0]!.id,
      quantity: 50,
    });
    await diary.copyEntry({ entryId: entry.id, destinationDate: DAY, destinationMealId: lunch });
    await diary.copyMeal({
      mealId: breakfast,
      sourceDate: DAY,
      destinationDate: '2026-09-26',
      destinationMealId: lunch,
    });
    const today = await diary.loadDay(DAY);
    expect(today.meals[1]!.entries[0]!.nutrients.extra).toEqual(entry.nutrients.extra);
    const tomorrow = await diary.loadDay('2026-09-26');
    expect(tomorrow.meals[1]!.entries[0]!.nutrients.extra).toEqual(entry.nutrients.extra);

    await diary.deleteEntry(entry.id);
    expect(await deps.db.getAll('SELECT * FROM diary_entry_nutrients WHERE entry_id = ?', [entry.id])).toEqual([]);
    await diary.restoreEntry(entry);
    expect((await diary.getEntry(entry.id)).nutrients.extra).toEqual(entry.nutrients.extra);
  });
});

describe('DATA-21: dashboard nutrients setting', () => {
  it('reads the default, saves order + visibility, and rejects incomplete lists', async () => {
    const { settings } = await setup();
    expect(await settings.getDashboardNutrients()).toEqual(DEFAULT_DASHBOARD_NUTRIENTS);
    const next = setDashboardNutrientVisible(DEFAULT_DASHBOARD_NUTRIENTS, 'vitamin_c', true)!;
    expect(await settings.setDashboardNutrients(next)).toEqual(next);
    expect(await settings.getDashboardNutrients()).toEqual(next);
    await expect(settings.setDashboardNutrients(next.slice(1))).rejects.toMatchObject({ category: 'validation' });
    await expect(settings.setDashboardNutrients([...next.slice(1), next[1]!])).rejects.toMatchObject({
      category: 'validation',
    });
    // Zero visible is allowed (the Diary hides its chevron).
    const none = NUTRIENT_IDS.map((id) => ({ id, visible: false }));
    expect(await settings.setDashboardNutrients(none)).toEqual(none);
  });

  it('remembers whether the Diary panel is open', async () => {
    const { settings } = await setup();
    expect(await settings.getDashboardNutrientsOpen()).toBe(false);
    await settings.setDashboardNutrientsOpen(true);
    expect(await settings.getDashboardNutrientsOpen()).toBe(true);
  });
});
