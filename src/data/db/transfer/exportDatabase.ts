// DATA-30 Export: `VACUUM INTO` a new file in the cache, one consistent snapshot (WAL included). Not a repository
// method: it takes the SqlDatabase directly, and only src/data/db runs SQL (DATA-18).
import { todayLocal, type Clock } from '@/shared/dates';
import { DatabaseError, isAppError } from '@/shared/errors';
import { logger } from '@/shared/logging/logger';

import type { SqlDatabase } from '../sql';
import { cacheDirectory, ensureDir, remove, removeDir, size, toUri } from './files';

export type ExportResult = { uri: string; bytes: number };

export function sizeBucket(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb < 1) return '<1MB';
  if (mb < 10) return '1–10MB';
  if (mb < 50) return '10–50MB';
  if (mb < 200) return '50–200MB';
  return '>200MB';
}

export const exportDirectory = () => `${cacheDirectory()}/export`;

export async function exportDatabase({ db, clock }: { db: SqlDatabase; clock: Clock }): Promise<ExportResult> {
  const started = clock.now().getTime();
  const dir = exportDirectory();
  const path = `${dir}/open-kcal-${todayLocal(clock)}.db`;
  try {
    // An older day's file or this day's earlier export would make VACUUM INTO fail (existing non-empty target).
    await removeDir(dir);
    await ensureDir(dir);
    // Bound, never interpolated (ARCH-09). Queued behind in-flight writes on the serial connection; outside a transaction.
    await db.run('VACUUM INTO ?', [path]);
    const bytes = await size(path);
    logger.info('export finished', {
      outcome: 'ok',
      sizeBucket: sizeBucket(bytes),
      durationMs: clock.now().getTime() - started,
    });
    return { uri: toUri(path), bytes };
  } catch (error) {
    await remove(path).catch(() => undefined);
    logger.info('export finished', { outcome: 'failed', durationMs: clock.now().getTime() - started });
    throw isAppError(error) ? error : new DatabaseError('Export failed', { cause: error });
  }
}
