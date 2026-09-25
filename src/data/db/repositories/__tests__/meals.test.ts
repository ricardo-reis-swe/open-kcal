import { openSeededTestDatabase, TEST_MEALS } from '@/shared/testing/testDb';

import { createMealsRepository } from '../mealsRepository';

async function setup() {
  const deps = await openSeededTestDatabase();
  const meals = createMealsRepository(deps);
  const list = await meals.list();
  return { deps, meals, list, byName: (n: string) => list.find((m) => m.name === n)!.id };
}

async function addEntry(deps: Awaited<ReturnType<typeof setup>>['deps'], mealId: string, id: string) {
  await deps.db.run(
    `INSERT INTO diary_entries (id, entry_kind, diary_date, meal_id, food_name_snapshot, energy_kcal, sort_order, created_at, updated_at)
     VALUES (?, 'quick_calories', '2026-09-25', ?, 'Quick Calories', 100, 0, 'x', 'x')`,
    [id, mealId],
  );
}

describe('DATA-10: meals repository', () => {
  it('lists the seeded meals in display order', async () => {
    const { list } = await setup();
    expect(list.map((m) => [m.name, m.sortOrder])).toEqual(TEST_MEALS.map((n, i) => [n, i]));
  });

  it('creates at the end, allows duplicate names, trims and rejects blank names', async () => {
    const { meals } = await setup();
    expect(await meals.create('  Lunch ')).toMatchObject({ name: 'Lunch', sortOrder: 4 });
    await expect(meals.create('   ')).rejects.toMatchObject({ category: 'validation' });
    expect((await meals.list()).filter((m) => m.name === 'Lunch')).toHaveLength(2);
  });

  it('renames; unknown ids are NotFound', async () => {
    const { meals, byName } = await setup();
    expect(await meals.rename(byName('Snacks'), 'Supper')).toMatchObject({ name: 'Supper', sortOrder: 3 });
    await expect(meals.rename('missing', 'X')).rejects.toMatchObject({ category: 'not_found' });
    await expect(meals.get('missing')).rejects.toMatchObject({ category: 'not_found' });
  });

  it('reorders in one two-phase transaction despite the UNIQUE sort_order', async () => {
    const { meals, list } = await setup();
    const reversed = [...list].reverse().map((m) => m.id);
    expect((await meals.reorder(reversed)).map((m) => m.name)).toEqual([...TEST_MEALS].reverse());
    expect((await meals.list()).map((m) => m.sortOrder)).toEqual([0, 1, 2, 3]);
  });

  it('reorder must list every meal exactly once', async () => {
    const { meals, list } = await setup();
    const ids = list.map((m) => m.id);
    for (const bad of [ids.slice(1), [...ids, ids[0]!], [ids[0]!, ids[0]!, ids[1]!, ids[2]!], [...ids.slice(1), 'x']]) {
      await expect(meals.reorder(bad)).rejects.toMatchObject({ category: 'validation' });
    }
    expect((await meals.list()).map((m) => m.id)).toEqual(ids);
  });

  it('deletes a meal without entries and compacts sort_order', async () => {
    const { meals, byName } = await setup();
    await meals.delete(byName('Lunch'), null);
    expect((await meals.list()).map((m) => [m.name, m.sortOrder])).toEqual([
      ['Breakfast', 0],
      ['Dinner', 1],
      ['Snacks', 2],
    ]);
  });

  it('delete + reassign moves entries and recents to the target meal', async () => {
    const { deps, meals, byName } = await setup();
    await addEntry(deps, byName('Lunch'), 'e1');
    await addEntry(deps, byName('Lunch'), 'e2');
    await deps.db.run(
      `INSERT INTO foods (id, source, name, basis_quantity, basis_unit, energy_kcal, protein_g, carbohydrate_g, fat_g, created_at, updated_at)
       VALUES ('f1', 'custom', 'Toast', 1, 'slice', 80, 3, 14, 1, 'x', 'x')`,
    );
    await deps.db.run(
      "INSERT INTO recent_foods (food_id, last_used_at, use_count, last_meal_id) VALUES ('f1', 'x', 1, ?)",
      [byName('Lunch')],
    );
    expect(await meals.countEntries(byName('Lunch'))).toBe(2);
    await expect(meals.delete(byName('Lunch'), null)).rejects.toMatchObject({ category: 'validation' });
    await expect(meals.delete(byName('Lunch'), byName('Lunch'))).rejects.toMatchObject({ category: 'validation' });

    await meals.delete(byName('Lunch'), byName('Dinner'));
    expect(await deps.db.getAll('SELECT id, meal_id FROM diary_entries ORDER BY id')).toEqual([
      { id: 'e1', meal_id: byName('Dinner') },
      { id: 'e2', meal_id: byName('Dinner') },
    ]);
    expect(await deps.db.getFirst('SELECT last_meal_id FROM recent_foods')).toEqual({ last_meal_id: byName('Dinner') });
    expect(await meals.countEntries(byName('Dinner'))).toBe(2);
  });

  it('ROAD-02 M8: delete + reassign rolls back fully on failure', async () => {
    const { deps, meals, byName } = await setup();
    await addEntry(deps, byName('Lunch'), 'e1');
    const before = {
      meals: await deps.db.getAll('SELECT * FROM meals ORDER BY sort_order'),
      entries: await deps.db.getAll('SELECT * FROM diary_entries'),
    };
    // Fail the final step (compaction) so the reassign and delete have already run inside the transaction.
    await deps.db.exec(
      `CREATE TRIGGER fail_compact BEFORE UPDATE OF sort_order ON meals BEGIN SELECT RAISE(ABORT, 'boom'); END`,
    );
    await expect(meals.delete(byName('Lunch'), byName('Dinner'))).rejects.toMatchObject({ category: 'database' });
    await deps.db.exec('DROP TRIGGER fail_compact');
    expect(await deps.db.getAll('SELECT * FROM meals ORDER BY sort_order')).toEqual(before.meals);
    expect(await deps.db.getAll('SELECT * FROM diary_entries')).toEqual(before.entries);
  });

  it('the last meal cannot be deleted', async () => {
    const { meals, list } = await setup();
    for (const m of list.slice(1)) await meals.delete(m.id, null);
    await expect(meals.delete(list[0]!.id, null)).rejects.toMatchObject({ category: 'conflict' });
    expect(await meals.list()).toHaveLength(1);
  });

  it('DATA-10: reassigned entries append after the target meal, per date, in their original order', async () => {
    const { deps, meals, byName } = await setup();
    const add = (id: string, mealId: string, date: string, sortOrder: number) =>
      deps.db.run(
        `INSERT INTO diary_entries (id, entry_kind, diary_date, meal_id, food_name_snapshot, energy_kcal, sort_order, created_at, updated_at)
         VALUES (?, 'quick_calories', ?, ?, 'Quick Calories', 1, ?, 'x', 'x')`,
        [id, date, mealId, sortOrder],
      );
    await add('d1', byName('Dinner'), '2026-09-25', 0);
    await add('d2', byName('Dinner'), '2026-09-25', 1);
    await add('l2', byName('Lunch'), '2026-09-25', 1);
    await add('l1', byName('Lunch'), '2026-09-25', 0);
    await add('l3', byName('Lunch'), '2026-09-26', 0);
    await meals.delete(byName('Lunch'), byName('Dinner'));
    expect(
      await deps.db.getAll('SELECT id, diary_date, sort_order FROM diary_entries ORDER BY diary_date, sort_order'),
    ).toEqual([
      { id: 'd1', diary_date: '2026-09-25', sort_order: 0 },
      { id: 'd2', diary_date: '2026-09-25', sort_order: 1 },
      { id: 'l1', diary_date: '2026-09-25', sort_order: 2 },
      { id: 'l2', diary_date: '2026-09-25', sort_order: 3 },
      { id: 'l3', diary_date: '2026-09-26', sort_order: 0 },
    ]);
  });
});
