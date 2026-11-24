import fs from 'node:fs';
import path from 'node:path';

import { DatabaseError } from '@/shared/errors';
import { fixedClock } from '@/shared/dates';
import { openTestDatabase } from '@/shared/testing/nodeSqlite';
import { openSeededTestDatabase, testClock } from '@/shared/testing/testDb';
import { makeDbFile, makeTempDir, queryFile } from '@/shared/testing/transferFixtures';

import { exportDatabase, exportDirectory } from '../exportDatabase';
import { toPath } from '../files';

const readDir = () => (fs.existsSync(exportDirectory()) ? fs.readdirSync(exportDirectory()) : []);

describe('DATA-30: export', () => {
  let dir: string;
  beforeEach(() => {
    dir = makeTempDir();
    fs.rmSync(exportDirectory(), { recursive: true, force: true });
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('writes exactly one valid file named open-kcal-<local date>.db', async () => {
    const { db, clock } = await openSeededTestDatabase();
    const { uri, bytes } = await exportDatabase({ db, clock });
    expect(path.basename(toPath(uri))).toBe('open-kcal-2026-09-25.db');
    expect(readDir()).toEqual(['open-kcal-2026-09-25.db']);
    expect(bytes).toBe(fs.statSync(toPath(uri)).size);
    expect(queryFile(toPath(uri), 'SELECT name FROM meals ORDER BY sort_order').map((r) => r.name)).toEqual([
      'Breakfast',
      'Lunch',
      'Dinner',
      'Snacks',
    ]);
  });

  it('includes rows written after the last checkpoint (WAL contents)', async () => {
    const file = await makeDbFile(dir, 'source.db', { entries: 3 });
    const db = await openTestDatabase(file);
    await db.exec('PRAGMA wal_autocheckpoint = 0');
    await db.run(
      `INSERT INTO diary_entries (id, entry_kind, diary_date, meal_id, food_name_snapshot, energy_kcal, sort_order, created_at, updated_at)
       SELECT 'late', 'quick_calories', '2026-09-20', id, 'Late', 5, 99, 'x', 'x' FROM meals LIMIT 1`,
    );
    expect(fs.existsSync(`${file}-wal`)).toBe(true); // the new row is only in the WAL
    const { uri } = await exportDatabase({ db, clock: testClock() });
    const rows = queryFile<{ id: string }>(toPath(uri), 'SELECT id FROM diary_entries ORDER BY id').map((r) => r.id);
    expect(rows).toEqual(['entry-0', 'entry-1', 'entry-2', 'late']);
    expect(fs.readdirSync(exportDirectory())).toHaveLength(1);
    await db.close();
  });

  it('exports a populated v7 database with the same version and row counts', async () => {
    const file = await makeDbFile(dir, 'source.db', { entries: 5 });
    const db = await openTestDatabase(file);
    const { uri } = await exportDatabase({ db, clock: testClock() });
    expect(queryFile(toPath(uri), 'SELECT MAX(version) AS v FROM schema_version')).toEqual([{ v: 7 }]);
    expect(queryFile(toPath(uri), 'SELECT COUNT(*) AS n FROM diary_entries')).toEqual([{ n: 5 }]);
    await db.close();
  });

  it('a second export the same day overwrites; an older day’s file is removed', async () => {
    const { db } = await openSeededTestDatabase();
    const clock = testClock('2026-09-25T10:00:00.000Z');
    await exportDatabase({ db, clock });
    await db.run("UPDATE meals SET name = 'Brunch' WHERE sort_order = 0");
    const second = await exportDatabase({ db, clock });
    expect(readDir()).toEqual(['open-kcal-2026-09-25.db']);
    expect(queryFile(toPath(second.uri), 'SELECT name FROM meals WHERE sort_order = 0')).toEqual([{ name: 'Brunch' }]);
    await exportDatabase({ db, clock: fixedClock('2026-09-26T10:00:00.000Z') });
    expect(readDir()).toEqual(['open-kcal-2026-09-26.db']);
  });

  it('a failure becomes DatabaseError and leaves no partial file', async () => {
    const { db, clock } = await openSeededTestDatabase();
    jest.spyOn(db, 'run').mockRejectedValueOnce(new Error('disk full'));
    await expect(exportDatabase({ db, clock })).rejects.toBeInstanceOf(DatabaseError);
    expect(readDir()).toEqual([]);
  });
});
