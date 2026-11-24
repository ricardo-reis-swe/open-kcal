import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { sequentialIds } from '@/data/db/ids';
import { seedDefaults } from '@/data/db/seed';
import { defaultUnitPreferences } from '@/domain/units/units';
import { toLocalDate } from '@/shared/dates';
import { DatabaseError } from '@/shared/errors';
import { testClock } from '@/shared/testing/testDb';
import { makeDbFile, makeTempDir, queryFile, sha256 } from '@/shared/testing/transferFixtures';

import { appDatabaseLocation, openAppDatabase, type DatabaseLocation } from '../../database';
import * as files from '../files';
import {
  cleanTransferCache,
  closeForSwap,
  commitImport,
  recoverInterruptedImport,
  rollbackImport,
  swapIn,
} from '../replaceDatabase';
import { exportDirectory } from '../exportDatabase';
import { importDirectory, stageImport } from '../validateImport';

const clock = testClock();
const logger = { info: () => undefined, error: () => undefined };
const options = () => ({
  clock,
  logger,
  seed: async (tx: Parameters<typeof seedDefaults>[0]) =>
    void (await seedDefaults(tx, {
      now: clock.now().toISOString(),
      today: toLocalDate(clock.now()),
      units: defaultUnitPreferences('metric'),
      mealNames: ['Original', 'Lunch'],
      ids: sequentialIds(),
    })),
});

describe('DATA-32: replace and rollback', () => {
  let dir: string;
  let location: DatabaseLocation;
  const main = () => path.join(dir, 'calorie-tracker.db');
  const safety = () => path.join(dir, 'calorie-tracker.pre-import.db');
  const marker = () => path.join(dir, 'import-pending');
  const mealNames = (file: string) =>
    queryFile<{ name: string }>(file, 'SELECT name FROM meals ORDER BY sort_order').map((r) => r.name);

  async function stagedImport() {
    const source = await makeDbFile(dir, 'export.db', { mealName: 'Ceia', entries: 3 });
    const picked = path.join(dir, 'picked.db');
    fs.copyFileSync(source, picked);
    return (await stageImport(files.toUri(picked), { clock, logger })).stagedPath;
  }

  beforeEach(() => {
    dir = makeTempDir();
    location = { directory: dir, name: 'calorie-tracker.db' };
  });
  afterEach(async () => {
    jest.restoreAllMocks();
    fs.rmSync(dir, { recursive: true, force: true });
    await files.removeDir(importDirectory());
  });

  it('the app database location is a plain path (no file:// URI)', () => {
    expect(appDatabaseLocation().name).toBe('calorie-tracker.db');
    expect(appDatabaseLocation().directory).not.toMatch(/^file:/);
  });

  it('success: swaps, reopens with the imported data, removes marker, safety copy and import/', async () => {
    const live = await openAppDatabase(options(), location);
    const staged = await stagedImport();
    await closeForSwap(live);
    await swapIn(location, staged);
    expect(fs.existsSync(marker())).toBe(true);
    expect(fs.existsSync(safety())).toBe(true);
    const reopened = await openAppDatabase(options(), location);
    expect(
      (await reopened.getAll<{ name: string }>('SELECT name FROM meals ORDER BY sort_order')).map((m) => m.name),
    ).toEqual(['Ceia', 'Lunch', 'Dinner', 'Snacks']);
    await commitImport(location);
    expect(fs.existsSync(marker())).toBe(false);
    expect(fs.existsSync(safety())).toBe(false);
    expect(fs.existsSync(importDirectory())).toBe(false);
    await reopened.close();
  });

  describe.each([
    ['4: the safety-copy rename', 1],
    ['5: moving the staged file in', 2],
  ])('a failure in step %s', (_name, failingCall) => {
    it('restores the original byte-for-byte and leaves no marker', async () => {
      const live = await openAppDatabase(options(), location);
      const staged = await stagedImport();
      await closeForSwap(live);
      const before = sha256(main());
      const realMove = files.move;
      let calls = 0;
      jest.spyOn(files, 'move').mockImplementation((from, to) => {
        calls += 1;
        return calls === failingCall ? Promise.reject(new DatabaseError('File operation failed')) : realMove(from, to);
      });
      await expect(swapIn(location, staged)).rejects.toBeInstanceOf(DatabaseError);
      jest.restoreAllMocks();
      await rollbackImport(location);
      expect(sha256(main())).toBe(before);
      expect(fs.existsSync(marker())).toBe(false);
      expect(fs.existsSync(safety())).toBe(false);
      expect(fs.existsSync(importDirectory())).toBe(false);
      const reopened = await openAppDatabase(options(), location);
      expect(
        (await reopened.getAll<{ name: string }>('SELECT name FROM meals ORDER BY sort_order')).map((m) => m.name),
      ).toEqual(['Original', 'Lunch']);
      await reopened.close();
    });
  });

  it('a failure in step 6 (the new file can’t start) restores the original byte-for-byte', async () => {
    const live = await openAppDatabase(options(), location);
    const staged = await stagedImport();
    await closeForSwap(live);
    const before = sha256(main());
    await swapIn(location, staged);
    expect(sha256(main())).not.toBe(before);
    await rollbackImport(location); // the gate's response to a failed start
    expect(sha256(main())).toBe(before);
    expect(fs.existsSync(marker())).toBe(false);
    expect(mealNames(main())).toEqual(['Original', 'Lunch']);
  });

  it('a marker at launch rolls the interrupted import back', async () => {
    const live = await openAppDatabase(options(), location);
    const staged = await stagedImport();
    await closeForSwap(live);
    const before = sha256(main());
    await swapIn(location, staged); // the app "dies" here
    expect(await recoverInterruptedImport(location)).toBe('rolledBack');
    expect(sha256(main())).toBe(before);
    expect(fs.existsSync(marker())).toBe(false);
    expect(await recoverInterruptedImport(location)).toBe('none'); // idempotent
  });

  it('a safety copy without a marker (died in step 7) is deleted and the import kept', async () => {
    const live = await openAppDatabase(options(), location);
    const staged = await stagedImport();
    await closeForSwap(live);
    await swapIn(location, staged);
    fs.rmSync(marker());
    expect(await recoverInterruptedImport(location)).toBe('none');
    expect(fs.existsSync(safety())).toBe(false);
    expect(mealNames(main())[0]).toBe('Ceia');
  });

  it('nothing to recover on a normal launch', async () => {
    await (await openAppDatabase(options(), location)).close();
    expect(await recoverInterruptedImport(location)).toBe('none');
  });

  it('a busy checkpoint stops before anything is moved', async () => {
    const live = await openAppDatabase(options(), location);
    const reader = new DatabaseSync(main());
    reader.exec('BEGIN');
    reader.prepare('SELECT COUNT(*) FROM meals').get(); // holds a read snapshot
    await live.run("UPDATE meals SET name = 'Changed' WHERE sort_order = 0"); // lands in the WAL after the snapshot
    await expect(closeForSwap(live)).rejects.toBeInstanceOf(DatabaseError);
    reader.exec('COMMIT');
    reader.close();
    expect(fs.existsSync(marker())).toBe(false);
    expect(fs.existsSync(safety())).toBe(false);
    expect((await live.getFirst<{ name: string }>('SELECT name FROM meals WHERE sort_order = 0'))?.name).toBe(
      'Changed',
    );
    await live.close();
  });

  it('cleanTransferCache removes the export and import folders', async () => {
    await files.ensureDir(exportDirectory());
    await files.ensureDir(importDirectory());
    await cleanTransferCache();
    expect(fs.existsSync(exportDirectory())).toBe(false);
    expect(fs.existsSync(importDirectory())).toBe(false);
  });
});
