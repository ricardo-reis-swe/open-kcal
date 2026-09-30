import { defaultUnitPreferences } from '@/domain/units/units';
import { fixedClock } from '@/shared/dates';
import { openTestDatabase } from '@/shared/testing/nodeSqlite';

import { prepareDatabase } from '../database';
import { sequentialIds } from '../ids';
import { LATEST_SCHEMA_VERSION, MIGRATIONS } from '../migrations';
import { readSchemaVersion } from '../migrations/runner';
import { seedDefaults, type SeedInput } from '../seed';
import type { SqlDatabase } from '../sql';

const clock = fixedClock('2026-09-25T10:00:00.000Z');
const logger = { info: jest.fn(), error: jest.fn() };
const EN_MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];
const PT_MEALS = ['Pequeno-almoço', 'Almoço', 'Jantar', 'Lanches'];

function input(overrides: Partial<SeedInput> = {}): SeedInput {
  return {
    now: '2026-09-25T10:00:00.000Z',
    today: '2026-09-25',
    units: defaultUnitPreferences('metric'),
    mealNames: EN_MEALS,
    ids: sequentialIds(),
    ...overrides,
  };
}

async function init(db: SqlDatabase, seed: SeedInput) {
  return prepareDatabase(db, { clock, logger, seed: async (tx) => void (await seedDefaults(tx, seed)) });
}

const counts = (db: SqlDatabase) =>
  db.getFirst(
    `SELECT (SELECT COUNT(*) FROM app_settings) AS settings, (SELECT COUNT(*) FROM meals) AS meals,
            (SELECT COUNT(*) FROM nutrition_goals) AS goals, (SELECT COUNT(*) FROM schema_version) AS versions`,
  );

describe('DATA-17: first-launch init + seed', () => {
  it('seeds settings, four meals in order and the provisional goal', async () => {
    const db = await openTestDatabase();
    await init(db, input());
    expect(await readSchemaVersion(db)).toBe(LATEST_SCHEMA_VERSION);
    expect(await db.getFirst('SELECT * FROM app_settings')).toEqual({
      id: 1,
      weight_unit: 'kg',
      food_weight_unit: 'g',
      energy_unit: 'kcal',
      volume_unit: 'ml',
      goal_weight_kg: null,
      goals_confirmed_at: null,
      created_at: '2026-09-25T10:00:00.000Z',
      updated_at: '2026-09-25T10:00:00.000Z',
      // DATA-19 default (migration 2)
      food_search_sections:
        '[{"id":"custom","visible":true},{"id":"saved","visible":true},{"id":"open_food_facts","visible":true},{"id":"usda","visible":true}]',
      dashboard_nutrients:
        '[{"id":"fibre","visible":true},{"id":"sugars","visible":true},{"id":"saturated_fat","visible":true},{"id":"salt","visible":true}]',
      dashboard_nutrients_open: 0,
      theme_preference: 'system', // DATA-23 default (migration 5)
    });
    expect(await db.getAll('SELECT name, sort_order FROM meals ORDER BY sort_order')).toEqual(
      EN_MEALS.map((name, sort_order) => ({ name, sort_order })),
    );
    // UX-01: 2,000 kcal · 250 g carbs · 100 g protein · 67 g fat, effective from the first-launch date.
    expect(
      await db.getAll(
        'SELECT effective_from, calorie_target_kcal, carbohydrate_target_g, protein_target_g, fat_target_g FROM nutrition_goals',
      ),
    ).toEqual([
      {
        effective_from: '2026-09-25',
        calorie_target_kcal: 2000,
        carbohydrate_target_g: 250,
        protein_target_g: 100,
        fat_target_g: 67,
      },
    ]);
  });

  it('is idempotent: running init twice duplicates nothing', async () => {
    const db = await openTestDatabase();
    await init(db, input());
    const before = await db.getAll('SELECT * FROM meals ORDER BY sort_order');
    await init(db, input({ ids: sequentialIds(100), today: '2026-09-26', mealNames: PT_MEALS }));
    expect(await counts(db)).toEqual({ settings: 1, meals: 4, goals: 1, versions: MIGRATIONS.length });
    expect(await db.getAll('SELECT * FROM meals ORDER BY sort_order')).toEqual(before);
  });

  it('DATA-10: writes meal names in the app language at first launch and never re-translates them', async () => {
    const db = await openTestDatabase();
    await init(db, input({ mealNames: PT_MEALS }));
    await init(db, input({ mealNames: EN_MEALS }));
    expect(
      (await db.getAll<{ name: string }>('SELECT name FROM meals ORDER BY sort_order')).map((m) => m.name),
    ).toEqual(PT_MEALS);
  });

  it('uses locale-informed unit defaults', async () => {
    const db = await openTestDatabase();
    await init(db, input({ units: defaultUnitPreferences('us') }));
    expect(
      await db.getFirst('SELECT weight_unit, food_weight_unit, energy_unit, volume_unit FROM app_settings'),
    ).toEqual({ weight_unit: 'lb', food_weight_unit: 'oz', energy_unit: 'kcal', volume_unit: 'fl_oz' });
  });

  it('a failed seed on first launch rolls back the schema too, and the next launch succeeds', async () => {
    const db = await openTestDatabase();
    await expect(init(db, input({ mealNames: ['Breakfast', '   '] }))).rejects.toMatchObject({ category: 'migration' });
    expect(await readSchemaVersion(db)).toBe(0);
    await init(db, input());
    expect(await counts(db)).toEqual({ settings: 1, meals: 4, goals: 1, versions: MIGRATIONS.length });
  });

  it('uses the generated UUIDs as meal and goal ids', async () => {
    const db = await openTestDatabase();
    await init(db, input());
    const ids = await db.getAll<{ id: string }>('SELECT id FROM meals UNION ALL SELECT id FROM nutrition_goals');
    expect(ids.map((r) => r.id)).toEqual([
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000002',
      '00000000-0000-4000-8000-000000000003',
      '00000000-0000-4000-8000-000000000004',
      '00000000-0000-4000-8000-000000000005',
    ]);
  });
});
