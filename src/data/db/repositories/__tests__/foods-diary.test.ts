import { openSeededTestDatabase } from '@/shared/testing/testDb';

import { createDiaryRepository, createRecentsRepository } from '../diaryRepository';
import { createFoodsRepository, type CustomFoodInput, type FoodInput } from '../foodsRepository';
import { createMealsRepository } from '../mealsRepository';

const DAY = '2026-09-25';

const eggs: CustomFoodInput = {
  name: ' Scrambled eggs ',
  brand: null,
  basisQuantity: 100,
  basisUnit: 'g',
  nutrients: { energyKcal: 150, carbohydrateG: 1, proteinG: 10, fatG: 11 },
  servings: [
    { label: 'g', quantity: 1, unit: 'g', basisMultiplier: 0.01 },
    { label: 'egg', quantity: 1, unit: 'egg', basisMultiplier: 0.5, isDefault: true },
  ],
};

const offBar = (energyKcal: number): FoodInput => ({
  name: 'Barra de cereais',
  brand: 'Marca',
  basisQuantity: 100,
  basisUnit: 'g',
  nutrients: { energyKcal, carbohydrateG: 60, proteinG: null, fatG: null },
  servings: [{ label: 'bar', quantity: 1, unit: 'bar', basisMultiplier: 0.25 }],
});
const cache = (expiresAt: string) => ({
  fetchedAt: '2026-09-25T10:00:00.000Z',
  expiresAt,
  rawPayloadJson: '{"code":"123"}',
  schemaVersion: 1,
});

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

describe('DATA-11 / DATA-16: foods repository', () => {
  it('creates a custom food with its servings and exactly one default', async () => {
    const { foods } = await setup();
    const food = await foods.createCustom(eggs);
    expect(food).toMatchObject({ source: 'custom', externalId: null, name: 'Scrambled eggs', isDeleted: false });
    expect(food.servings.map((s) => [s.label, s.isDefault, s.sortOrder])).toEqual([
      ['g', false, 0],
      ['egg', true, 1],
    ]);
    const noDefault = await foods.createCustom({ ...eggs, servings: [eggs.servings[0]!] });
    expect(noDefault.servings[0]!.isDefault).toBe(true);
  });

  it('custom foods require every macro and a complete serving', async () => {
    const { foods } = await setup();
    const missingMacro = { ...eggs, nutrients: { ...eggs.nutrients, fatG: null } } as unknown as CustomFoodInput;
    await expect(foods.createCustom(missingMacro)).rejects.toMatchObject({ category: 'validation', fields: ['fatG'] });
    await expect(
      foods.createCustom({ ...eggs, servings: [{ label: 'slice', quantity: 1, unit: 'slice', basisMultiplier: 0 }] }),
    ).rejects.toMatchObject({ fields: ['servings.0'] });
    await expect(foods.createCustom({ ...eggs, servings: [] })).rejects.toMatchObject({ fields: ['servings'] });
  });

  it('DATA-15: upserts external foods by (source, external_id) without duplicating; unknown macros stay NULL', async () => {
    const { deps, foods } = await setup();
    const first = await foods.upsertExternal('open_food_facts', '123', offBar(400), cache('2026-10-25T10:00:00.000Z'));
    const again = await foods.upsertExternal('open_food_facts', '123', offBar(410), cache('2026-10-26T10:00:00.000Z'));
    expect(again.id).toBe(first.id);
    expect(again.nutrients).toEqual({ energyKcal: 410, carbohydrateG: 60, proteinG: null, fatG: null });
    expect(await deps.db.getFirst('SELECT COUNT(*) AS c FROM foods')).toEqual({ c: 1 });
    expect(await deps.db.getFirst('SELECT COUNT(*) AS c FROM food_servings')).toEqual({ c: 1 });
    // Same external id from another source is a different food (no cross-source merge).
    const usda = await foods.upsertExternal('usda', '123', offBar(400), cache('2026-10-25T10:00:00.000Z'));
    expect(usda.id).not.toBe(first.id);
  });

  it('DATA-15: expired cache stays loggable; expiry only flags refresh', async () => {
    const { deps, foods, diary, breakfast } = await setup();
    const food = await foods.upsertExternal('open_food_facts', '9', offBar(400), cache('2026-09-26T10:00:00.000Z'));
    expect(await foods.cacheMetadata(food.id)).toMatchObject({ isExpired: false, schemaVersion: 1 });
    deps.clock.set('2026-09-27T10:00:00.000Z');
    expect(await foods.cacheMetadata(food.id)).toMatchObject({ isExpired: true });
    await expect(
      diary.addFoodEntry({
        diaryDate: DAY,
        mealId: breakfast,
        foodId: food.id,
        servingId: food.servings[0]!.id,
        quantity: 1,
      }),
    ).resolves.toMatchObject({ nutrients: { energyKcal: 100 } });
  });

  it('soft-deletes custom foods: gone from recents, entries keep their snapshots', async () => {
    const { foods, diary, recents, breakfast } = await setup();
    const food = await foods.createCustom(eggs);
    const entry = await diary.addFoodEntry({
      diaryDate: DAY,
      mealId: breakfast,
      foodId: food.id,
      servingId: food.servings[1]!.id,
      quantity: 2,
    });
    expect(await recents.list()).toHaveLength(1);
    await foods.deleteCustom(food.id);
    expect((await foods.get(food.id)).isDeleted).toBe(true);
    expect(await recents.list()).toEqual([]);
    expect(await diary.getEntry(entry.id)).toMatchObject({
      foodId: food.id,
      name: 'Scrambled eggs',
      nutrients: { energyKcal: 150 },
    });
    await expect(
      diary.addFoodEntry({
        diaryDate: DAY,
        mealId: breakfast,
        foodId: food.id,
        servingId: food.servings[1]!.id,
        quantity: 1,
      }),
    ).rejects.toMatchObject({ category: 'not_found' });
  });
});

describe('DATA-05 / DATA-06 / DATA-16: diary repository', () => {
  it('DATA-07: an empty day shows every meal with zero totals and the effective goal', async () => {
    const { diary } = await setup();
    const day = await diary.loadDay('2026-12-31');
    expect(day.meals.map((m) => [m.meal.name, m.entries.length, m.totals.energyKcal])).toEqual([
      ['Breakfast', 0, 0],
      ['Lunch', 0, 0],
      ['Dinner', 0, 0],
      ['Snacks', 0, 0],
    ]);
    expect(day.goal).toMatchObject({ calorieTargetKcal: 2000 });
    expect((await diary.loadDay('2026-09-01')).goal).toBeNull();
    await expect(diary.loadDay('2026-02-30')).rejects.toMatchObject({ category: 'validation' });
  });

  it('adds a food entry with an unrounded snapshot, in meal order, and upserts the recent', async () => {
    const { foods, diary, recents, breakfast } = await setup();
    const food = await foods.createCustom(eggs);
    const egg = food.servings[1]!;
    const a = await diary.addFoodEntry({
      diaryDate: DAY,
      mealId: breakfast,
      foodId: food.id,
      servingId: egg.id,
      quantity: 2,
    });
    const b = await diary.addFoodEntry({
      diaryDate: DAY,
      mealId: breakfast,
      foodId: food.id,
      servingId: food.servings[0]!.id,
      quantity: 33.3,
    });
    expect(a).toMatchObject({ kind: 'food', servingQuantity: 2, servingUnit: 'egg', sortOrder: 0 });
    expect(a.nutrients).toEqual({ energyKcal: 150, carbohydrateG: 1, proteinG: 10, fatG: 11 });
    expect(b.sortOrder).toBe(1);
    expect(b.nutrients.energyKcal).toBeCloseTo(49.95, 10); // DATA-04: not rounded
    expect(await recents.list()).toEqual([
      expect.objectContaining({ foodId: food.id, useCount: 2, lastServingQuantity: 33.3, lastMealId: breakfast }),
    ]);
  });

  it('DATA-05: history keeps its snapshot when the food changes or disappears', async () => {
    const { deps, foods, diary, lunch } = await setup();
    const food = await foods.upsertExternal('open_food_facts', '1', offBar(400), cache('2027-01-01T00:00:00.000Z'));
    const entry = await diary.addFoodEntry({
      diaryDate: DAY,
      mealId: lunch,
      foodId: food.id,
      servingId: food.servings[0]!.id,
      quantity: 1,
    });
    await foods.upsertExternal(
      'open_food_facts',
      '1',
      { ...offBar(999), name: 'Renamed' },
      cache('2027-01-01T00:00:00.000Z'),
    );
    expect(await diary.getEntry(entry.id)).toMatchObject({ name: 'Barra de cereais', nutrients: { energyKcal: 100 } });
    await deps.db.run('DELETE FROM foods WHERE id = ?', [food.id]); // e.g. later maintenance purge
    const orphan = await diary.getEntry(entry.id);
    expect(orphan).toMatchObject({
      foodId: null,
      name: 'Barra de cereais',
      brand: 'Marca',
      nutrients: { energyKcal: 100 },
    });
    // Still editable (quantity scales the snapshot) without the food.
    expect((await diary.editFoodEntry(entry.id, { mealId: lunch, quantity: 2 })).nutrients).toEqual({
      energyKcal: 200,
      carbohydrateG: 30,
      proteinG: null,
      fatG: null,
    });
  });

  it('DATA-06: day and meal totals are known sum + unknown count, never coerced to 0', async () => {
    const { foods, diary, breakfast, lunch } = await setup();
    const bar = await foods.upsertExternal('open_food_facts', '1', offBar(400), cache('2027-01-01T00:00:00.000Z'));
    const food = await foods.createCustom(eggs);
    await diary.addFoodEntry({
      diaryDate: DAY,
      mealId: breakfast,
      foodId: food.id,
      servingId: food.servings[1]!.id,
      quantity: 2,
    });
    await diary.addFoodEntry({
      diaryDate: DAY,
      mealId: breakfast,
      foodId: bar.id,
      servingId: bar.servings[0]!.id,
      quantity: 1,
    });
    await diary.addQuickCalories({ diaryDate: DAY, mealId: lunch, energyKcal: 300, note: '  ' });
    const day = await diary.loadDay(DAY);
    expect(day.meals[0]!.totals).toEqual({
      energyKcal: 250,
      entryCount: 2,
      carbohydrateG: { knownSum: 16, unknownCount: 0 },
      proteinG: { knownSum: 10, unknownCount: 1 },
      fatG: { knownSum: 11, unknownCount: 1 },
    });
    expect(day.totals).toEqual({
      energyKcal: 550,
      entryCount: 3,
      carbohydrateG: { knownSum: 16, unknownCount: 1 },
      proteinG: { knownSum: 10, unknownCount: 2 },
      fatG: { knownSum: 11, unknownCount: 2 },
    });
    expect(day.meals[1]!.entries[0]).toMatchObject({ kind: 'quick_calories', name: 'Quick Calories', note: null });
    // Other days are unaffected.
    expect((await diary.loadDay('2026-09-26')).totals.entryCount).toBe(0);
  });

  it('Quick Calories: kcal ≥ 0, macros and serving NULL, note trimmed, no recents; edit moves meal', async () => {
    const { deps, diary, recents, breakfast, lunch } = await setup();
    const qc = await diary.addQuickCalories({ diaryDate: DAY, mealId: breakfast, energyKcal: 0, note: ' coffee ' });
    expect(qc).toMatchObject({
      servingQuantity: null,
      servingUnit: null,
      note: 'coffee',
      nutrients: { energyKcal: 0, carbohydrateG: null, proteinG: null, fatG: null },
    });
    await expect(diary.addQuickCalories({ diaryDate: DAY, mealId: breakfast, energyKcal: -1 })).rejects.toMatchObject({
      category: 'validation',
    });
    await expect(diary.addQuickCalories({ diaryDate: DAY, mealId: 'nope', energyKcal: 1 })).rejects.toMatchObject({
      category: 'not_found',
    });
    const edited = await diary.editQuickCalories(qc.id, { mealId: lunch, energyKcal: 250, note: '' });
    expect(edited).toMatchObject({ mealId: lunch, note: null, nutrients: { energyKcal: 250 } });
    expect(await recents.list()).toEqual([]);
    expect(await deps.db.getFirst('SELECT COUNT(*) AS c FROM recent_foods')).toEqual({ c: 0 });
  });

  it('DATA-12: moving an entry changes only meal_id + updated_at', async () => {
    const { deps, foods, diary, breakfast, lunch } = await setup();
    const food = await foods.createCustom(eggs);
    await diary.addQuickCalories({ diaryDate: DAY, mealId: lunch, energyKcal: 100 });
    const entry = await diary.addFoodEntry({
      diaryDate: DAY,
      mealId: breakfast,
      foodId: food.id,
      servingId: food.servings[1]!.id,
      quantity: 2,
    });
    const rowOf = () =>
      deps.db.getFirst<Record<string, unknown>>('SELECT * FROM diary_entries WHERE id = ?', [entry.id]);
    const before = await rowOf();
    deps.clock.advance(60_000);
    // The editor passes the unchanged serving along with the new meal.
    await diary.editFoodEntry(entry.id, { mealId: lunch, quantity: 2, servingId: food.servings[1]!.id });
    const after = await rowOf();
    expect(after).toEqual({ ...before, meal_id: lunch, updated_at: '2026-09-25T10:01:00.000Z' });
  });

  it('DATA-16: a changed serving recomputes from the food', async () => {
    const { foods, diary, breakfast } = await setup();
    const food = await foods.createCustom(eggs);
    const entry = await diary.addFoodEntry({
      diaryDate: DAY,
      mealId: breakfast,
      foodId: food.id,
      servingId: food.servings[1]!.id,
      quantity: 2,
    });
    const grams = await diary.editFoodEntry(entry.id, {
      mealId: breakfast,
      quantity: 50,
      servingId: food.servings[0]!.id,
    });
    expect(grams).toMatchObject({ servingUnit: 'g', servingQuantity: 50, nutrients: { energyKcal: 75 } });
  });

  it('DATA-05: passing the same serving after a cache refresh never rewrites the snapshot', async () => {
    const { foods, diary, breakfast } = await setup();
    const food = await foods.upsertExternal('open_food_facts', '1', offBar(400), cache('2027-01-01T00:00:00.000Z'));
    const entry = await diary.addFoodEntry({
      diaryDate: DAY,
      mealId: breakfast,
      foodId: food.id,
      servingId: food.servings[0]!.id,
      quantity: 1,
    });
    const refreshed = await foods.upsertExternal(
      'open_food_facts',
      '1',
      offBar(999),
      cache('2027-02-01T00:00:00.000Z'),
    );
    const edited = await diary.editFoodEntry(entry.id, {
      mealId: breakfast,
      quantity: 2,
      servingId: refreshed.servings[0]!.id,
    });
    // Scaled from the saved snapshot (100 kcal per bar), not recomputed from the refreshed 999 kcal/100 g.
    expect(edited.nutrients).toEqual({ energyKcal: 200, carbohydrateG: 30, proteinG: null, fatG: null });
  });

  it('DATA-12: delete is physical and leaves recents use_count alone', async () => {
    const { foods, diary, recents, breakfast } = await setup();
    const food = await foods.createCustom(eggs);
    const entry = await diary.addFoodEntry({
      diaryDate: DAY,
      mealId: breakfast,
      foodId: food.id,
      servingId: food.servings[1]!.id,
      quantity: 1,
    });
    await diary.deleteEntry(entry.id);
    await expect(diary.getEntry(entry.id)).rejects.toMatchObject({ category: 'not_found' });
    await expect(diary.deleteEntry(entry.id)).rejects.toMatchObject({ category: 'not_found' });
    expect((await recents.list())[0]).toMatchObject({ useCount: 1 });
  });

  it('rejects a serving from another food', async () => {
    const { foods, diary, breakfast } = await setup();
    const a = await foods.createCustom(eggs);
    const b = await foods.createCustom({ ...eggs, name: 'Other' });
    await expect(
      diary.addFoodEntry({
        diaryDate: DAY,
        mealId: breakfast,
        foodId: a.id,
        servingId: b.servings[0]!.id,
        quantity: 1,
      }),
    ).rejects.toMatchObject({ category: 'validation', fields: ['servingId'] });
  });
});

describe('PROV-09: refresh merges servings by (label, unit)', () => {
  it('keeps matched serving ids (and recents), inserts new ones, deletes missing ones', async () => {
    const { foods, diary, recents, breakfast } = await setup();
    const withServings = (servings: FoodInput['servings']): FoodInput => ({ ...offBar(400), servings });
    const first = await foods.upsertExternal(
      'open_food_facts',
      '7',
      withServings([
        { label: 'bar', quantity: 1, unit: 'bar', basisMultiplier: 0.25 },
        { label: 'pack', quantity: 1, unit: 'pack', basisMultiplier: 1 },
      ]),
      cache('2027-01-01T00:00:00.000Z'),
    );
    const bar = first.servings[0]!;
    await diary.addFoodEntry({ diaryDate: DAY, mealId: breakfast, foodId: first.id, servingId: bar.id, quantity: 1 });
    const refreshed = await foods.upsertExternal(
      'open_food_facts',
      '7',
      withServings([
        { label: 'g', quantity: 1, unit: 'g', basisMultiplier: 0.01 },
        { label: 'Bar', quantity: 1, unit: 'BAR', basisMultiplier: 0.3, isDefault: true }, // case-insensitive match
      ]),
      cache('2027-02-01T00:00:00.000Z'),
    );
    const refreshedBar = refreshed.servings.find((s) => s.label === 'Bar')!;
    expect(refreshedBar).toMatchObject({ id: bar.id, basisMultiplier: 0.3, isDefault: true, sortOrder: 1 });
    expect(refreshed.servings.map((s) => s.label)).toEqual(['g', 'Bar']); // 'pack' deleted, 'g' inserted
    expect(refreshed.servings.filter((s) => s.isDefault)).toHaveLength(1);
    expect((await recents.list())[0]).toMatchObject({ lastServingId: bar.id });
  });
});
