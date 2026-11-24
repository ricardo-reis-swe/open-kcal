/// <reference types="node" />
// Fixtures for the export/import tests (ARCH-18, ARCH-25): real SQLite files in a temp dir, at any schema version.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { sequentialIds } from '@/data/db/ids';
import { MIGRATIONS } from '@/data/db/migrations';
import { migrate } from '@/data/db/migrations/runner';
import { seedDefaults } from '@/data/db/seed';
import { defaultUnitPreferences } from '@/domain/units/units';
import { toLocalDate } from '@/shared/dates';

import { openTestDatabase } from './nodeSqlite';
import { testClock } from './testDb';

export function makeTempDir(prefix = 'open-kcal-fixture-'): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

export type FixtureOptions = {
  /** Schema version to build (default: latest). */
  version?: number;
  /** Run the first-launch seed (default true). */
  seed?: boolean;
  /** Number of Quick Calories diary entries, on consecutive dates from 2026-09-01. */
  entries?: number;
  /** First meal's name when seeded. */
  mealName?: string;
};

/** A real file database (WAL, as the app opens it) at `version`, closed cleanly, with some rows. */
export async function makeDbFile(
  dir: string,
  name: string,
  { version = MIGRATIONS.length, seed = true, entries = 0, mealName }: FixtureOptions = {},
): Promise<string> {
  const file = path.join(dir, name);
  const clock = testClock();
  const db = await openTestDatabase(file);
  await migrate(db, MIGRATIONS.slice(0, version), {
    clock,
    logger: { info: () => undefined, error: () => undefined },
    seed: seed
      ? async (tx) =>
          void (await seedDefaults(tx, {
            now: clock.now().toISOString(),
            today: toLocalDate(clock.now()),
            units: defaultUnitPreferences('metric'),
            mealNames: [mealName ?? 'Breakfast', 'Lunch', 'Dinner', 'Snacks'],
            ids: sequentialIds(),
          }))
      : undefined,
  });
  if (entries > 0) {
    const meal = await db.getFirst<{ id: string }>('SELECT id FROM meals ORDER BY sort_order LIMIT 1');
    for (let i = 0; i < entries; i++) {
      await db.run(
        `INSERT INTO diary_entries (id, entry_kind, diary_date, meal_id, food_name_snapshot, energy_kcal, sort_order, created_at, updated_at)
         VALUES (?, 'quick_calories', ?, ?, 'Quick calories', ?, ?, ?, ?)`,
        [
          `entry-${i}`,
          `2026-09-${String(i + 1).padStart(2, '0')}`,
          meal!.id,
          100 + i,
          i,
          clock.now().toISOString(),
          clock.now().toISOString(),
        ],
      );
    }
  }
  await db.getFirst('PRAGMA wal_checkpoint(TRUNCATE)');
  await db.close();
  return file;
}

/** Overwrites everything from the third page on with 0xFF, keeping the header intact. */
export function corruptPages(file: string): void {
  const size = fs.statSync(file).size;
  const fd = fs.openSync(file, 'r+');
  try {
    fs.writeSync(fd, Buffer.alloc(size - 8192, 0xff), 0, size - 8192, 8192);
  } finally {
    fs.closeSync(fd);
  }
}

export const sha256 = (file: string): string => createHash('sha256').update(fs.readFileSync(file)).digest('hex');

/** Runs `sql` on a file with plain node:sqlite (no app code), for assertions. */
export function queryFile<Row = Record<string, unknown>>(file: string, sql: string): Row[] {
  const db = new DatabaseSync(file);
  try {
    return db
      .prepare(sql)
      .all()
      .map((r) => ({ ...(r as object) }) as Row);
  } finally {
    db.close();
  }
}

/** Runs statements on a file with plain node:sqlite (to build the invalid fixtures). */
export function execOnFile(file: string, sql: string): void {
  const db = new DatabaseSync(file);
  try {
    db.exec(sql);
  } finally {
    db.close();
  }
}
