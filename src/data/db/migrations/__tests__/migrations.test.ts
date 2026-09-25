/// <reference types="node" />
import { readFileSync } from 'fs';
import { join } from 'path';

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
  return db.getAll<{ type: string; name: string; sql: string | null }>(
    "SELECT type, name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name",
  );
}

describe('DATA-17: migrations', () => {
  it('migration 1 from an empty DB matches schema.sql exactly', async () => {
    const migrated = await openTestDatabase();
    await migrate(migrated, MIGRATIONS, { clock, logger: quietLogger() });
    const reference = await openTestDatabase();
    await reference.exec(readFileSync(join(__dirname, '../../schema/schema.sql'), 'utf8'));
    expect(await schemaOf(migrated)).toEqual(await schemaOf(reference));
    expect(await readSchemaVersion(migrated)).toBe(1);
    expect(LATEST_SCHEMA_VERSION).toBe(1);
  });

  it('is detected as already applied on the next launch', async () => {
    const db = await openTestDatabase();
    const logger = quietLogger();
    const first = await migrate(db, MIGRATIONS, { clock, logger });
    const second = await migrate(db, MIGRATIONS, { clock, logger });
    expect(first.applied).toEqual([1]);
    expect(second).toEqual({ fromVersion: 1, toVersion: 1, applied: [] });
    expect(await db.getAll('SELECT version FROM schema_version')).toEqual([{ version: 1 }]);
  });

  it('ARCH-15: logs only version, duration and outcome', async () => {
    const db = await openTestDatabase();
    const logger = quietLogger();
    await migrate(db, MIGRATIONS, { clock, logger });
    expect(logger.info).toHaveBeenCalledWith('migration applied', { version: 1, durationMs: 0, outcome: 'ok' });
  });

  it('runs a later migration on existing data, preserving it, and records its version after success', async () => {
    const db = await openTestDatabase();
    await migrate(db, MIGRATIONS, { clock, logger: quietLogger() });
    await db.run(
      "INSERT INTO meals (id, name, sort_order, created_at, updated_at) VALUES ('m1', 'Breakfast', 0, 'x', 'x')",
    );
    const m2: Migration = {
      version: 2,
      name: 'add meal colour',
      up: (tx) => tx.exec('ALTER TABLE meals ADD COLUMN colour TEXT'),
    };
    const result = await migrate(db, [...MIGRATIONS, m2], { clock, logger: quietLogger() });
    expect(result).toEqual({ fromVersion: 1, toVersion: 2, applied: [2] });
    expect(await db.getAll('SELECT id, name, colour FROM meals')).toEqual([
      { id: 'm1', name: 'Breakfast', colour: null },
    ]);
    expect(await readSchemaVersion(db)).toBe(2);
  });

  it('rolls back a failed migration fully and keeps the previous version and data', async () => {
    const db = await openTestDatabase();
    await migrate(db, MIGRATIONS, { clock, logger: quietLogger() });
    await db.run(
      "INSERT INTO meals (id, name, sort_order, created_at, updated_at) VALUES ('m1', 'Breakfast', 0, 'x', 'x')",
    );
    const broken: Migration = {
      version: 2,
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
      version: 2,
    });
    expect(logger.error).toHaveBeenCalledWith('migration failed', undefined, {
      version: 2,
      durationMs: 0,
      outcome: 'failed',
    });
    expect(await readSchemaVersion(db)).toBe(1);
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
    expect(await readSchemaVersion(db)).toBe(1);
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
    const gap: Migration = { version: 3, name: 'gap', up: async () => undefined };
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
    ).rejects.toThrow(/FOREIGN KEY/);
  });
});
