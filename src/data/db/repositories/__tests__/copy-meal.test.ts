import { openSeededTestDatabase } from '@/shared/testing/testDb';

import { createDiaryRepository, createRecentsRepository } from '../diaryRepository';
import { createFoodsRepository, type CustomFoodInput } from '../foodsRepository';
import { createMealsRepository } from '../mealsRepository';

const SOURCE = '2026-09-25';
const TOMORROW = '2026-09-26';

const toast: CustomFoodInput = {
  name: 'Toast',
  brand: 'Padaria',
  basisQuantity: 100,
  basisUnit: 'g',
  nutrients: { energyKcal: 260, carbohydrateG: 48, proteinG: 9, fatG: 3 },
  servings: [{ label: 'slice', quantity: 1, unit: 'slice', basisMultiplier: 0.25, isDefault: true }],
};

const SNAPSHOT_COLUMNS = `entry_kind, meal_id, food_id, food_name_snapshot, brand_snapshot, serving_quantity,
  serving_unit_snapshot, energy_kcal, protein_g, carbohydrate_g, fat_g, note`;

async function setup() {
  const deps = await openSeededTestDatabase();
  const meals = await createMealsRepository(deps).list();
  const foods = createFoodsRepository(deps);
  const diary = createDiaryRepository(deps);
  const breakfast = meals[0]!.id;
  const lunch = meals[1]!.id;
  const food = await foods.createCustom(toast);
  // Source: Breakfast on SOURCE = toast ×2, then Quick Calories with a note. Lunch has one entry that must stay put.
  const first = await diary.addFoodEntry({
    diaryDate: SOURCE,
    mealId: breakfast,
    foodId: food.id,
    servingId: food.servings[0]!.id,
    quantity: 2,
  });
  const second = await diary.addQuickCalories({ diaryDate: SOURCE, mealId: breakfast, energyKcal: 120, note: 'Café' });
  await diary.addQuickCalories({ diaryDate: SOURCE, mealId: lunch, energyKcal: 500 });
  const snapshots = (date: string, mealId: string) =>
    deps.db.getAll(
      `SELECT ${SNAPSHOT_COLUMNS} FROM diary_entries WHERE diary_date = ? AND meal_id = ? ORDER BY sort_order`,
      [date, mealId],
    );
  return {
    deps,
    foods,
    diary,
    recents: createRecentsRepository(deps),
    breakfast,
    lunch,
    food,
    first,
    second,
    snapshots,
  };
}

describe('DATA-16 Copy meal', () => {
  it('copies snapshots exactly, in order, to the same meal on the destination date with new IDs', async () => {
    const { deps, diary, breakfast, lunch, first, second, snapshots } = await setup();
    deps.clock.advance(60_000);
    await expect(diary.copyMeal({ mealId: breakfast, sourceDate: SOURCE, destinationDate: TOMORROW })).resolves.toEqual(
      { copiedCount: 2 },
    );
    expect(await snapshots(TOMORROW, breakfast)).toEqual(await snapshots(SOURCE, breakfast));
    const day = await diary.loadDay(TOMORROW);
    const copied = day.meals[0]!.entries;
    expect(copied.map((e) => [e.name, e.sortOrder, e.note])).toEqual([
      ['Toast', 0, null],
      ['Quick Calories', 1, 'Café'],
    ]);
    expect(copied.map((e) => e.id)).not.toContain(first.id);
    expect(copied.map((e) => e.id)).not.toContain(second.id);
    expect(day.meals[0]!.totals.energyKcal).toBeCloseTo(130 + 120, 10);
    expect(await snapshots(TOMORROW, lunch)).toEqual([]); // other meals untouched
    const createdAt = await deps.db.getAll<{ created_at: string; updated_at: string }>(
      'SELECT created_at, updated_at FROM diary_entries WHERE diary_date = ?',
      [TOMORROW],
    );
    expect(new Set(createdAt.flatMap((r) => [r.created_at, r.updated_at]))).toEqual(
      new Set([deps.clock.now().toISOString()]),
    );
  });

  it('appends after the destination meal’s existing entries; copying onto the source date duplicates (UX-12)', async () => {
    const { diary, breakfast } = await setup();
    await diary.addQuickCalories({ diaryDate: TOMORROW, mealId: breakfast, energyKcal: 10 });
    await diary.copyMeal({ mealId: breakfast, sourceDate: SOURCE, destinationDate: TOMORROW });
    expect((await diary.loadDay(TOMORROW)).meals[0]!.entries.map((e) => [e.nutrients.energyKcal, e.sortOrder])).toEqual(
      [
        [10, 0],
        [130, 1],
        [120, 2],
      ],
    );
    await diary.copyMeal({ mealId: breakfast, sourceDate: SOURCE, destinationDate: SOURCE });
    expect((await diary.loadDay(SOURCE)).meals[0]!.entries.map((e) => [e.nutrients.energyKcal, e.sortOrder])).toEqual([
      [130, 0],
      [120, 1],
      [130, 2],
      [120, 3],
    ]);
  });

  it('copies are independent of the originals', async () => {
    const { diary, breakfast, first, second } = await setup();
    await diary.copyMeal({ mealId: breakfast, sourceDate: SOURCE, destinationDate: TOMORROW });
    await diary.editFoodEntry(first.id, { mealId: breakfast, quantity: 3 });
    await diary.deleteEntry(second.id);
    expect((await diary.loadDay(TOMORROW)).meals[0]!.entries.map((e) => e.nutrients.energyKcal)).toEqual([130, 120]);
  });

  it('keeps the snapshot when the food was since soft-deleted, and never touches recents', async () => {
    const { deps, foods, diary, recents, breakfast, food } = await setup();
    await foods.deleteCustom(food.id);
    const recentRows = await deps.db.getAll('SELECT * FROM recent_foods');
    await diary.copyMeal({ mealId: breakfast, sourceDate: SOURCE, destinationDate: TOMORROW });
    expect((await diary.loadDay(TOMORROW)).meals[0]!.entries[0]).toMatchObject({ foodId: food.id, name: 'Toast' });
    expect(await deps.db.getAll('SELECT * FROM recent_foods')).toEqual(recentRows);
    expect(await recents.list()).toEqual([]);
  });

  it('an empty source meal copies nothing', async () => {
    const { diary, lunch } = await setup();
    await expect(diary.copyMeal({ mealId: lunch, sourceDate: TOMORROW, destinationDate: SOURCE })).resolves.toEqual({
      copiedCount: 0,
    });
    expect((await diary.loadDay(SOURCE)).meals[1]!.entries).toHaveLength(1);
  });

  it('rejects an unknown meal or an invalid date without writing', async () => {
    const { deps, diary, breakfast } = await setup();
    const count = async () => (await deps.db.getFirst<{ n: number }>('SELECT COUNT(*) AS n FROM diary_entries'))!.n;
    await expect(
      diary.copyMeal({ mealId: 'gone', sourceDate: SOURCE, destinationDate: TOMORROW }),
    ).rejects.toMatchObject({ category: 'not_found' });
    await expect(
      diary.copyMeal({ mealId: breakfast, sourceDate: SOURCE, destinationDate: '2026-02-30' }),
    ).rejects.toMatchObject({ category: 'validation' });
    expect(await count()).toBe(3);
  });

  it('rolls back fully when an insert fails mid-copy (one transaction)', async () => {
    const { deps, diary, breakfast } = await setup();
    const before = await deps.db.getAll('SELECT * FROM diary_entries ORDER BY id');
    // Let the first copy in, fail the second: the first must not survive.
    await deps.db.exec(
      `CREATE TRIGGER fail_second_copy BEFORE INSERT ON diary_entries
       WHEN NEW.diary_date = '${TOMORROW}' AND NEW.sort_order = 1 BEGIN SELECT RAISE(ABORT, 'boom'); END`,
    );
    await expect(
      diary.copyMeal({ mealId: breakfast, sourceDate: SOURCE, destinationDate: TOMORROW }),
    ).rejects.toMatchObject({ category: 'database' });
    await deps.db.exec('DROP TRIGGER fail_second_copy');
    expect(await deps.db.getAll('SELECT * FROM diary_entries ORDER BY id')).toEqual(before);
  });
});
