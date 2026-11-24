// DATA-32 Replace and rollback: the file steps of an import, on a database location. No React; StartupGate
// (ARCH-25) owns the stop → swap → restart order and calls these. Every step is idempotent so a crash anywhere
// leaves the next launch able to roll back (marker) or finish (safety copy only).
import { DatabaseError } from '@/shared/errors';

import type { DatabaseLocation } from '../database';
import type { SqlDatabase } from '../sql';
import { exportDirectory } from './exportDatabase';
import { exists, move, remove, removeDir, writeText } from './files';
import { importDirectory } from './validateImport';

const paths = (location: DatabaseLocation) => {
  const dir = location.directory.replace(/\/+$/, '');
  const main = `${dir}/${location.name}`;
  return {
    main,
    safety: `${dir}/${location.name.replace(/\.db$/, '')}.pre-import.db`,
    marker: `${dir}/import-pending`,
    sidecars: [`${main}-wal`, `${main}-shm`],
  };
};

async function removeSidecars(sidecars: readonly string[]): Promise<void> {
  for (const sidecar of sidecars) await remove(sidecar);
}

/** DATA-32 step 2 (data part): checkpoint the WAL into the main file, then close. Busy → nothing has changed. */
export async function closeForSwap(db: SqlDatabase): Promise<void> {
  await db.exec('PRAGMA busy_timeout = 2000');
  const result = await db.getFirst<{ busy: number }>('PRAGMA wal_checkpoint(TRUNCATE)');
  if (!result || result.busy !== 0) throw new DatabaseError('Database is busy');
  await db.close();
}

/** DATA-32 steps 3–5: marker → safety copy → staged file becomes the database. */
export async function swapIn(location: DatabaseLocation, stagedPath: string): Promise<void> {
  const { main, safety, marker, sidecars } = paths(location);
  await writeText(marker, '1');
  await move(main, safety);
  await removeSidecars(sidecars); // safe: the checkpoint in closeForSwap emptied the WAL
  // The widget may have created an empty main in the gap (ARCH-25); the move overwrites it.
  await move(stagedPath, main);
  await removeSidecars(sidecars);
}

/** DATA-32 step 7: marker first, then the safety copy (a crash in between is "import succeeded"). */
export async function commitImport(location: DatabaseLocation): Promise<void> {
  const { safety, marker } = paths(location);
  await remove(marker); // a failure throws: the caller rolls back rather than leave a marker that undoes a good import
  // Leftovers are harmless: recovery deletes a safety copy that has no marker; the cache is cleaned at launch.
  await remove(safety).catch(() => undefined);
  await removeDir(importDirectory()).catch(() => undefined);
}

/** Puts the safety copy back. Idempotent: used for a failure in this session and for launch recovery. */
export async function rollbackImport(location: DatabaseLocation): Promise<void> {
  const { main, safety, marker, sidecars } = paths(location);
  if (await exists(safety)) {
    await remove(main);
    await removeSidecars(sidecars);
    await move(safety, main);
  }
  await remove(marker); // last: a crash mid-rollback retries on the next launch
  await removeDir(importDirectory());
}

/** Before opening the database at launch (DATA-32). `rolledBack` → show `importInterrupted` once. */
export async function recoverInterruptedImport(location: DatabaseLocation): Promise<'none' | 'rolledBack'> {
  const { safety, marker } = paths(location);
  if (await exists(marker)) {
    await rollbackImport(location);
    return 'rolledBack';
  }
  if (await exists(safety)) await remove(safety); // the app died in step 7: the import had succeeded
  return 'none';
}

/** DATA-30: exported and staged files don't outlive the app session. Best effort. */
export async function cleanTransferCache(): Promise<void> {
  await removeDir(exportDirectory());
  await removeDir(importDirectory());
}
