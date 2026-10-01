/// <reference types="node" />
import { readFileSync } from 'fs';
import { join } from 'path';

import { DEFAULT_FOOD_SEARCH_SECTIONS } from '@/domain/food/searchSections';
import { DEFAULT_DASHBOARD_NUTRIENTS, parseDashboardNutrients } from '@/domain/nutrition/dashboardNutrients';
import { MigrationError } from '@/shared/errors';
import { fixedClock } from '@/shared/dates';
import { openTestDatabase } from '@/shared/testing/nodeSqlite';

import { prepareDatabase } from '../../database';
import type { SqlExecutor } from '../../sql';
import { LATEST_SCHEMA_VERSION, MIGRATIONS, type Migration } from '..';
import { migrate, readSchemaVersion } from '../runner';

const clock = fixedClock('2026-09-25T10:00:00.000Z');
const quietLogger = () => ({ info: jest.fn(), error: jest.fn() });

async function schemaOf(db: SqlExecutor) {
  const rows = await db.getAll<{ type: string; name: string; sql: string | null }>(
    "SELECT type, name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name",
  );
  // `ALTER TABLE ... ADD COLUMN` rewrites the stored CREATE text with different whitespace; compare without it.
  return rows.map((row) => ({ ...row, sql: row.sql?.replace(/\s+/g, '') ?? null }));
}

describe('DATA-17: migrations', () => {
  it('every migration from an empty DB builds schema.sql exactly', async () => {
    const migrated = await openTestDatabase();
    await migrate(migrated, MIGRATIONS, { clock, logger: quietLogger() });
    const reference = await openTestDatabase();
    await reference.exec(readFileSync(join(__dirname, '../../schema/schema.sql'), 'utf8'));
    expect(await schemaOf(migrated)).toEqual(await schemaOf(reference));
    expect(await readSchemaVersion(migrated)).toBe(7);
    expect(LATEST_SCHEMA_VERSION).toBe(7);
  });

  it('DATA-19: migration 2 adds food_search_sections with the default, preserving existing settings', async () => {
    const db = await openTestDatabase();
    await migrate(db, MIGRATIONS.slice(0, 1), { clock, logger: quietLogger() });
    await db.run(
      "INSERT INTO app_settings (id, weight_unit, food_weight_unit, energy_unit, volume_unit, goal_weight_kg, goals_confirmed_at, created_at, updated_at) VALUES (1, 'lb', 'oz', 'kJ', 'fl_oz', 80, 'x', 'x', 'x')",
    );
    const result = await migrate(db, MIGRATIONS.slice(0, 2), { clock, logger: quietLogger() });
    expect(result).toEqual({ fromVersion: 1, toVersion: 2, applied: [2] });
    const row = await db.getFirst<Record<string, unknown>>('SELECT * FROM app_settings');
    expect(row).toMatchObject({ weight_unit: 'lb', energy_unit: 'kJ', goal_weight_kg: 80 });
    expect(JSON.parse(row!.food_search_sections as string)).toEqual(DEFAULT_FOOD_SEARCH_SECTIONS);
  });

  it('DATA-23: migration 5 adds the theme preference as system, preserving existing settings', async () => {
    const db = await openTestDatabase();
    await migrate(db, MIGRATIONS.slice(0, 4), { clock, logger: quietLogger() });
    await db.run(
      "INSERT INTO app_settings (id, weight_unit, food_weight_unit, energy_unit, volume_unit, goal_weight_kg, goals_confirmed_at, created_at, updated_at) VALUES (1, 'lb', 'oz', 'kJ', 'fl_oz', 80, 'x', 'x', 'x')",
    );
    expect(await migrate(db, MIGRATIONS.slice(0, 5), { clock, logger: quietLogger() })).toEqual({
      fromVersion: 4,
      toVersion: 5,
      applied: [5],
    });
    const row = await db.getFirst<Record<string, unknown>>('SELECT * FROM app_settings');
    expect(row).toMatchObject({ weight_unit: 'lb', goal_weight_kg: 80, theme_preference: 'system' });
    await expect(db.run("UPDATE app_settings SET theme_preference = 'sepia'")).rejects.toThrow();
  });

  it('DATA-24: migration 6 adds foods.barcode and backfills saved OFF foods by zero-padding', async () => {
    const db = await openTestDatabase();
    await migrate(db, MIGRATIONS.slice(0, 5), { clock, logger: quietLogger() });
    const insert = (id: string, source: string, externalId: string | null) =>
      db.run(
        `INSERT INTO foods (id, source, external_id, name, basis_quantity, basis_unit, energy_kcal, created_at, updated_at)
         VALUES (?, ?, ?, 'Food', 100, 'g', 100, 'x', 'x')`,
        [id, source, externalId],
      );
    await insert('off13', 'open_food_facts', '5601009983179');
    await insert('off12', 'open_food_facts', '031200037206');
    await insert('off8', 'open_food_facts', '96385074');
    await insert('offOdd', 'open_food_facts', '12345');
    await insert('offText', 'open_food_facts', 'abc1234567890');
    await insert('usda', 'usda', '2035482');
    await insert('custom', 'custom', null);
    expect(await migrate(db, MIGRATIONS.slice(0, 6), { clock, logger: quietLogger() })).toEqual({
      fromVersion: 5,
      toVersion: 6,
      applied: [6],
    });
    const rows = await db.getAll<{ id: string; barcode: string | null }>('SELECT id, barcode FROM foods ORDER BY id');
    expect(Object.fromEntries(rows.map((row) => [row.id, row.barcode]))).toEqual({
      custom: null,
      off12: '00031200037206',
      off13: '05601009983179',
      off8: '00000096385074',
      offOdd: null,
      offText: null,
      usda: null,
    });
    await expect(db.run("UPDATE foods SET barcode = '123' WHERE id = 'custom'")).rejects.toThrow();
  });

  it('DATA-27: migration 7 adds foods.kind (existing foods = food) and the recipe tables', async () => {
    const db = await openTestDatabase();
    await migrate(db, MIGRATIONS.slice(0, 6), { clock, logger: quietLogger() });
    await db.run(
      `INSERT INTO foods (id, source, external_id, name, basis_quantity, basis_unit, energy_kcal, created_at, updated_at)
       VALUES ('f1', 'open_food_facts', '123', 'Food', 100, 'g', 100, 'x', 'x')`,
    );
    expect(await migrate(db, MIGRATIONS.slice(0, 7), { clock, logger: quietLogger() })).toEqual({
      fromVersion: 6,
      toVersion: 7,
      applied: [7],
    });
    expect(await db.getFirst('SELECT kind FROM foods WHERE id = ?', ['f1'])).toEqual({ kind: 'food' });
    // A recipe must be a custom food.
    await expect(db.run("UPDATE foods SET kind = 'recipe' WHERE id = 'f1'")).rejects.toThrow();
    await expect(db.run("INSERT INTO recipes (food_id, servings_count) VALUES ('f1', 0)")).rejects.toThrow();
  });

  it('DATA-09: migration 3 preserves existing goals as fixed-gram targets', async () => {
    const db = await openTestDatabase();
    await migrate(db, MIGRATIONS.slice(0, 2), { clock, logger: quietLogger() });
    await db.run(
      "INSERT INTO nutrition_goals (id, effective_from, calorie_target_kcal, carbohydrate_target_g, protein_target_g, fat_target_g, created_at, updated_at) VALUES ('g1', '2026-09-25', 2000, 250, 100, 67, 'x', 'x')",
    );
    const result = await migrate(db, MIGRATIONS.slice(0, 3), { clock, logger: quietLogger() });
    expect(result).toEqual({ fromVersion: 2, toVersion: 3, applied: [3] });
    expect(
      await db.getFirst<Record<string, unknown>>('SELECT * FROM nutrition_goals WHERE id = ?', ['g1']),
    ).toMatchObject({
      macro_target_mode: 'grams',
      carbohydrate_target_percent: null,
      protein_target_percent: null,
      fat_target_percent: null,
    });
  });

  it.each([1, 2, 3])(
    'DATA-20 / DATA-21: migration 4 from v%i keeps foods, entries and settings; nutrients start unknown',
    async (fromVersion) => {
      const db = await openTestDatabase();
      await migrate(db, MIGRATIONS.slice(0, fromVersion), { clock, logger: quietLogger() });
      await db.exec(`
        INSERT INTO app_settings (id, weight_unit, food_weight_unit, energy_unit, volume_unit, created_at, updated_at)
          VALUES (1, 'kg', 'g', 'kJ', 'ml', 'x', 'x');
        INSERT INTO meals (id, name, sort_order, created_at, updated_at) VALUES ('m1', 'Breakfast', 0, 'x', 'x');
        INSERT INTO foods (id, source, external_id, name, basis_quantity, basis_unit, energy_kcal, protein_g,
            carbohydrate_g, fat_g, is_deleted, created_at, updated_at)
          VALUES ('f1', 'custom', NULL, 'Oats', 100, 'g', 380, 13, 60, 7, 0, 'x', 'x');
        INSERT INTO diary_entries (id, entry_kind, diary_date, meal_id, food_id, food_name_snapshot, serving_quantity,
            serving_unit_snapshot, energy_kcal, protein_g, carbohydrate_g, fat_g, sort_order, created_at, updated_at)
          VALUES ('e1', 'food', '2026-09-25', 'm1', 'f1', 'Oats', 50, 'g', 190, 6.5, 30, 3.5, 0, 'x', 'x');
      `);
      const result = await migrate(db, MIGRATIONS.slice(0, 4), { clock, logger: quietLogger() });
      expect(result.toVersion).toBe(4);
      expect(await db.getFirst('SELECT name, energy_kcal FROM foods')).toEqual({ name: 'Oats', energy_kcal: 380 });
      expect(await db.getFirst('SELECT energy_kcal, protein_g FROM diary_entries')).toEqual({
        energy_kcal: 190,
        protein_g: 6.5,
      });
      expect(await db.getAll('SELECT * FROM food_nutrients')).toEqual([]);
      expect(await db.getAll('SELECT * FROM diary_entry_nutrients')).toEqual([]);
      const settings = await db.getFirst<Record<string, unknown>>('SELECT * FROM app_settings');
      expect(settings).toMatchObject({ energy_unit: 'kJ', dashboard_nutrients_open: 0 });
      expect(parseDashboardNutrients(settings!.dashboard_nutrients)).toEqual(DEFAULT_DASHBOARD_NUTRIENTS);
    },
  );

  it('DATA-20: nutrient rows follow their food / entry deletes', async () => {
    const db = await openTestDatabase();
    await prepareDatabase(db, { clock, logger: quietLogger() });
    await db.exec(`
      INSERT INTO meals (id, name, sort_order, created_at, updated_at) VALUES ('m1', 'Breakfast', 0, 'x', 'x');
      INSERT INTO foods (id, source, external_id, name, basis_quantity, basis_unit, energy_kcal, is_deleted,
          created_at, updated_at) VALUES ('f1', 'custom', NULL, 'Oats', 100, 'g', 380, 0, 'x', 'x');
      INSERT INTO food_nutrients (food_id, nutrient_id, amount) VALUES ('f1', 'fibre', 10);
      INSERT INTO diary_entries (id, entry_kind, diary_date, meal_id, food_id, food_name_snapshot, serving_quantity,
          serving_unit_snapshot, energy_kcal, sort_order, created_at, updated_at)
        VALUES ('e1', 'food', '2026-09-25', 'm1', 'f1', 'Oats', 50, 'g', 190, 0, 'x', 'x');
      INSERT INTO diary_entry_nutrients (entry_id, nutrient_id, amount) VALUES ('e1', 'fibre', 5);
    `);
    await expect(
      db.run("INSERT INTO food_nutrients (food_id, nutrient_id, amount) VALUES ('f1', 'sugars', -1)"),
    ).rejects.toMatchObject({ category: 'database' });
    await db.run("DELETE FROM diary_entries WHERE id = 'e1'");
    expect(await db.getAll('SELECT * FROM diary_entry_nutrients')).toEqual([]);
    await db.run("DELETE FROM foods WHERE id = 'f1'");
    expect(await db.getAll('SELECT * FROM food_nutrients')).toEqual([]);
  });

  it('is detected as already applied on the next launch', async () => {
    const db = await openTestDatabase();
    const logger = quietLogger();
    const first = await migrate(db, MIGRATIONS, { clock, logger });
    const second = await migrate(db, MIGRATIONS, { clock, logger });
    expect(first.applied).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(second).toEqual({ fromVersion: 7, toVersion: 7, applied: [] });
    expect(await db.getAll('SELECT version FROM schema_version ORDER BY version')).toEqual([
      { version: 1 },
      { version: 2 },
      { version: 3 },
      { version: 4 },
      { version: 5 },
      { version: 6 },
      { version: 7 },
    ]);
  });

  it('ARCH-15: logs only version, duration and outcome', async () => {
    const db = await openTestDatabase();
    const logger = quietLogger();
    await migrate(db, MIGRATIONS, { clock, logger });
    expect(logger.info).toHaveBeenCalledWith('migration applied', {
      version: LATEST_SCHEMA_VERSION,
      durationMs: 0,
      outcome: 'ok',
    });
  });

  it('runs a later migration on existing data, preserving it, and records its version after success', async () => {
    const db = await openTestDatabase();
    await migrate(db, MIGRATIONS, { clock, logger: quietLogger() });
    await db.run(
      "INSERT INTO meals (id, name, sort_order, created_at, updated_at) VALUES ('m1', 'Breakfast', 0, 'x', 'x')",
    );
    const next: Migration = {
      version: LATEST_SCHEMA_VERSION + 1,
      name: 'add meal colour',
      up: (tx) => tx.exec('ALTER TABLE meals ADD COLUMN colour TEXT'),
    };
    const result = await migrate(db, [...MIGRATIONS, next], { clock, logger: quietLogger() });
    expect(result).toEqual({
      fromVersion: LATEST_SCHEMA_VERSION,
      toVersion: LATEST_SCHEMA_VERSION + 1,
      applied: [LATEST_SCHEMA_VERSION + 1],
    });
    expect(await db.getAll('SELECT id, name, colour FROM meals')).toEqual([
      { id: 'm1', name: 'Breakfast', colour: null },
    ]);
    expect(await readSchemaVersion(db)).toBe(LATEST_SCHEMA_VERSION + 1);
  });

  it('rolls back a failed migration fully and keeps the previous version and data', async () => {
    const db = await openTestDatabase();
    await migrate(db, MIGRATIONS, { clock, logger: quietLogger() });
    await db.run(
      "INSERT INTO meals (id, name, sort_order, created_at, updated_at) VALUES ('m1', 'Breakfast', 0, 'x', 'x')",
    );
    const broken: Migration = {
      version: LATEST_SCHEMA_VERSION + 1,
      name: 'broken',
      up: async (tx) => {
        await tx.exec('ALTER TABLE meals ADD COLUMN colour TEXT');
        await tx.exec('UPDATE meals SET colour = 1');
        await tx.exec('THIS IS NOT SQL');
      },
    };
    const logger = quietLogger();
    await expect(migrate(db, [...MIGRATIONS, broken], { clock, logger })).rejects.toMatchObject({
      category: 'migration',
      version: LATEST_SCHEMA_VERSION + 1,
    });
    expect(logger.error).toHaveBeenCalledWith('migration failed', undefined, {
      version: LATEST_SCHEMA_VERSION + 1,
      durationMs: 0,
      outcome: 'failed',
    });
    expect(await readSchemaVersion(db)).toBe(LATEST_SCHEMA_VERSION);
    expect(await db.getAll('SELECT * FROM meals')).toEqual([
      { id: 'm1', name: 'Breakfast', sort_order: 0, created_at: 'x', updated_at: 'x' },
    ]);
  });

  it('an interrupted first launch leaves an empty DB that the next launch initializes', async () => {
    const db = await openTestDatabase();
    const seed = jest.fn().mockRejectedValueOnce(new Error('killed'));
    await expect(migrate(db, MIGRATIONS, { clock, logger: quietLogger(), seed })).rejects.toBeInstanceOf(
      MigrationError,
    );
    expect(await schemaOf(db)).toEqual([]);
    seed.mockResolvedValueOnce(undefined);
    await migrate(db, MIGRATIONS, { clock, logger: quietLogger(), seed });
    expect(await readSchemaVersion(db)).toBe(LATEST_SCHEMA_VERSION);
  });

  it('refuses a database written by a newer app instead of resetting it', async () => {
    const db = await openTestDatabase();
    await migrate(db, MIGRATIONS, { clock, logger: quietLogger() });
    await db.run("INSERT INTO schema_version (version, applied_at) VALUES (9, 'x')");
    await expect(migrate(db, MIGRATIONS, { clock, logger: quietLogger() })).rejects.toMatchObject({
      category: 'migration',
      version: 9,
    });
    expect(await readSchemaVersion(db)).toBe(9);
  });

  it('rejects gaps in migration numbering', async () => {
    const db = await openTestDatabase();
    const gap: Migration = { version: LATEST_SCHEMA_VERSION + 2, name: 'gap', up: async () => undefined };
    await expect(migrate(db, [...MIGRATIONS, gap], { clock, logger: quietLogger() })).rejects.toBeInstanceOf(
      MigrationError,
    );
  });

  it('ARCH-09: prepareDatabase turns on foreign keys before migrating', async () => {
    const db = await openTestDatabase();
    await db.exec('PRAGMA foreign_keys = OFF');
    await prepareDatabase(db, { clock, logger: quietLogger() });
    expect(await db.getFirst('PRAGMA foreign_keys')).toEqual({ foreign_keys: 1 });
    await expect(
      db.run(
        "INSERT INTO diary_entries (id, entry_kind, diary_date, meal_id, food_name_snapshot, energy_kcal, sort_order, created_at, updated_at) VALUES ('e', 'quick_calories', '2026-09-25', 'missing', 'Quick Calories', 1, 0, 'x', 'x')",
      ),
    ).rejects.toMatchObject({
      category: 'database',
      cause: expect.objectContaining({ message: expect.stringMatching(/FOREIGN KEY/) }),
    });
  });
});
