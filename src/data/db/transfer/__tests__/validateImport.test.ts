import fs from 'node:fs';
import path from 'node:path';

import { DatabaseError, ValidationError, type ImportRejectReason } from '@/shared/errors';
import { testClock } from '@/shared/testing/testDb';
import {
  corruptPages,
  execOnFile,
  makeDbFile,
  makeTempDir,
  queryFile,
  sha256,
} from '@/shared/testing/transferFixtures';

import { toPath, toUri } from '../files';
import { discardStagedImport, importDirectory, stageImport } from '../validateImport';

const logger = { info: jest.fn(), error: jest.fn() };

describe('DATA-31: import validation', () => {
  let dir: string;
  beforeEach(() => {
    dir = makeTempDir();
    logger.info.mockClear();
  });
  afterEach(async () => {
    fs.rmSync(dir, { recursive: true, force: true });
    await discardStagedImport();
  });

  /** The picker's cache copy: stageImport moves it, so each call gets its own copy of the fixture. */
  const pick = (file: string) => {
    const picked = path.join(dir, `picked-${path.basename(file)}`);
    fs.copyFileSync(file, picked);
    return toUri(picked);
  };
  const stage = (file: string, extra: { maxBytes?: number; size?: number | null } = {}) =>
    stageImport(pick(file), { clock: testClock(), logger, ...extra });

  async function expectReason(promise: Promise<unknown>, reason: ImportRejectReason) {
    const error: unknown = await promise.then(
      () => null,
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).reason).toBe(reason);
    expect((error as ValidationError).message).toBe('Import rejected');
    expect(fs.existsSync(importDirectory())).toBe(false); // the staged copy is removed after every failure
  }

  it('accepts a populated v7 file unchanged and returns the dialog summary', async () => {
    const file = await makeDbFile(dir, 'ok.db', { entries: 3 });
    const { stagedPath, summary } = await stage(file);
    expect(summary).toEqual({ schemaVersion: 7, entryCount: 3, latestDiaryDate: '2026-09-03' });
    expect(queryFile(stagedPath, 'SELECT MAX(version) AS v FROM schema_version')).toEqual([{ v: 7 }]);
    expect(fs.readdirSync(importDirectory())).toEqual(['staged.db']); // one file, no -wal/-shm
  });

  it.each([1, 2, 3, 4, 5, 6])('migrates a v%i file on the staged copy', async (version) => {
    const file = await makeDbFile(dir, `v${version}.db`, { version, entries: 2 });
    const { stagedPath, summary } = await stage(file);
    expect(summary.schemaVersion).toBe(version);
    expect(summary.entryCount).toBe(2);
    expect(queryFile(stagedPath, 'SELECT MAX(version) AS v FROM schema_version')).toEqual([{ v: 7 }]);
    expect(queryFile(stagedPath, 'SELECT COUNT(*) AS n FROM diary_entries')).toEqual([{ n: 2 }]);
  });

  it('an empty diary gives count 0 and no latest date', async () => {
    const { summary } = await stage(await makeDbFile(dir, 'empty-diary.db'));
    expect(summary).toMatchObject({ entryCount: 0, latestDiaryDate: null });
  });

  it('never touches the live database', async () => {
    const live = await makeDbFile(dir, 'live.db', { entries: 1 });
    const before = sha256(live);
    await stage(await makeDbFile(dir, 'other.db', { entries: 2 }));
    await expect(stage(await makeDbFile(dir, 'bad.db', { version: 3, seed: false }))).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect(sha256(live)).toBe(before);
  });

  it('logs only outcome, reason, schema version, size bucket and duration', async () => {
    await stage(await makeDbFile(dir, 'ok.db'));
    const context = logger.info.mock.calls.find(([message]) => message === 'import checked')?.[1] as object;
    expect(Object.keys(context).sort()).toEqual(['durationMs', 'outcome', 'schemaVersion', 'sizeBucket']);
  });

  describe('reasons', () => {
    it('empty', async () => {
      const file = path.join(dir, 'zero.db');
      fs.writeFileSync(file, '');
      const picked = pick(file);
      await expect(stageImport(picked, { clock: testClock(), logger })).rejects.toMatchObject({ reason: 'empty' });
      expect(fs.existsSync(toPath(picked))).toBe(false); // DATA-32: the picker's cache copy is gone
    });

    it('tooLarge, before any copy when the picker reported the size', async () => {
      const file = await makeDbFile(dir, 'big.db');
      await expectReason(stage(file, { maxBytes: 10 }), 'tooLarge');
      const picked = pick(file);
      await expect(stageImport(picked, { clock: testClock(), logger, size: 500 * 1024 * 1024 })).rejects.toMatchObject({
        reason: 'tooLarge',
      });
      expect(fs.existsSync(toPath(picked))).toBe(false);
    });

    it('notSqlite', async () => {
      const file = path.join(dir, 'random.db');
      fs.writeFileSync(file, Buffer.from(Array.from({ length: 4096 }, (_, i) => (i * 37 + 11) % 251)));
      await expectReason(stage(file), 'notSqlite');
    });

    it('corrupt: damaged pages', async () => {
      const file = await makeDbFile(dir, 'damaged.db', { entries: 5 });
      corruptPages(file);
      await expectReason(stage(file), 'corrupt');
    });

    it('corrupt: a foreign key violation', async () => {
      const file = await makeDbFile(dir, 'fk.db');
      execOnFile(
        file,
        `PRAGMA foreign_keys = OFF;
         INSERT INTO diary_entries (id, entry_kind, diary_date, meal_id, food_name_snapshot, energy_kcal, sort_order, created_at, updated_at)
         VALUES ('x', 'quick_calories', '2026-09-01', 'no-such-meal', 'Quick', 1, 0, 'x', 'x');`,
      );
      await expectReason(stage(file), 'corrupt');
    });

    it('notOpenKcal: a plain SQLite file with an unrelated table', async () => {
      const file = path.join(dir, 'plain.db');
      execOnFile(file, 'CREATE TABLE notes (id INTEGER PRIMARY KEY, body TEXT)');
      await expectReason(stage(file), 'notOpenKcal');
    });

    it('notOpenKcal: schema_version without rows', async () => {
      const file = await makeDbFile(dir, 'noversion.db');
      execOnFile(file, 'DELETE FROM schema_version');
      await expectReason(stage(file), 'notOpenKcal');
    });

    it('notOpenKcal: a required table is missing', async () => {
      const file = await makeDbFile(dir, 'nomeals.db');
      execOnFile(file, 'PRAGMA foreign_keys = OFF; DROP TABLE diary_entries; DROP TABLE meals;');
      await expectReason(stage(file), 'notOpenKcal');
    });

    it('notOpenKcal: an extra table', async () => {
      const file = await makeDbFile(dir, 'extra-table.db');
      execOnFile(file, 'CREATE TABLE tracking (id INTEGER)');
      await expectReason(stage(file), 'notOpenKcal');
    });

    it('notOpenKcal: an extra column', async () => {
      const file = await makeDbFile(dir, 'extra-column.db');
      execOnFile(file, 'ALTER TABLE meals ADD COLUMN colour TEXT');
      await expectReason(stage(file), 'notOpenKcal');
    });

    it('notOpenKcal: no meals', async () => {
      const file = await makeDbFile(dir, 'zero-meals.db');
      execOnFile(file, 'DELETE FROM meals');
      await expectReason(stage(file), 'notOpenKcal');
    });

    it('notOpenKcal: no settings row', async () => {
      const file = await makeDbFile(dir, 'zero-settings.db');
      execOnFile(file, 'DELETE FROM app_settings');
      await expectReason(stage(file), 'notOpenKcal');
    });

    it('newerVersion: a file from a newer app is never downgraded', async () => {
      const file = await makeDbFile(dir, 'future.db');
      execOnFile(file, "INSERT INTO schema_version (version, applied_at) VALUES (8, 'x')");
      await expectReason(stage(file), 'newerVersion');
    });

    it('migrationFailed: a migration that cannot run on the staged copy', async () => {
      const file = await makeDbFile(dir, 'conflict.db', { version: 3 });
      // Migration 4 adds this column; the file already has an incompatible one.
      execOnFile(file, 'ALTER TABLE app_settings ADD COLUMN dashboard_nutrients TEXT');
      await expectReason(stage(file), 'migrationFailed');
    });
  });

  it('a file the app cannot read is a DatabaseError, not a rejection', async () => {
    await expect(
      stageImport(toUri(path.join(dir, 'missing.db')), { clock: testClock(), logger }),
    ).rejects.toBeInstanceOf(DatabaseError);
    expect(fs.existsSync(importDirectory())).toBe(false);
  });
});
