// Migration runner (DATA-17, ARCH-09). Detects the current version, runs pending migrations forward-only, records
// each version only after all its steps succeed, and never recovers by deleting or recreating the database.
import { MigrationError } from '@/shared/errors';
import { nowUtcIso, type Clock } from '@/shared/dates';
import type { Logger } from '@/shared/logging/logger';

import type { SqlDatabase, SqlExecutor } from '../sql';
import type { Migration } from './types';

export type MigrationOptions = {
  clock: Clock;
  logger: Pick<Logger, 'info' | 'error'>;
  /**
   * Idempotent seed. On a fresh install it runs in the same transaction as the schema, before the version is
   * recorded (DATA-17 "one transaction"); on later launches it runs in its own transaction and must be a no-op
   * when the data already exists.
   */
  seed?: (tx: SqlExecutor) => Promise<void>;
};

export type MigrationResult = { fromVersion: number; toVersion: number; applied: number[] };

export async function readSchemaVersion(db: SqlExecutor): Promise<number> {
  const table = await db.getFirst<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'schema_version'",
  );
  if (!table) return 0;
  const row = await db.getFirst<{ version: number | null }>('SELECT MAX(version) AS version FROM schema_version');
  return row?.version ?? 0;
}

function assertOrdered(migrations: readonly Migration[]): void {
  migrations.forEach((m, i) => {
    if (!Number.isInteger(m.version) || m.version !== i + 1) {
      throw new MigrationError('Migrations must be numbered 1..n without gaps', m.version);
    }
  });
}

async function recordVersion(tx: SqlExecutor, version: number, clock: Clock): Promise<void> {
  await tx.run('INSERT INTO schema_version (version, applied_at) VALUES (?, ?)', [version, nowUtcIso(clock)]);
}

export async function migrate(
  db: SqlDatabase,
  migrations: readonly Migration[],
  { clock, logger, seed }: MigrationOptions,
): Promise<MigrationResult> {
  assertOrdered(migrations);
  const latest = migrations.length;
  const fromVersion = await readSchemaVersion(db);
  if (fromVersion > latest) {
    // A newer app wrote this DB. Refuse rather than guess (recovery screen, UX-20).
    throw new MigrationError('Database is newer than this app', fromVersion);
  }
  const pending = migrations.filter((m) => m.version > fromVersion);
  const applied: number[] = [];

  // ARCH-15: log only version, duration and outcome category.
  const timed = async (version: number, task: () => Promise<void>) => {
    const started = clock.now().getTime();
    try {
      await task();
    } catch (error) {
      logger.error('migration failed', { version, durationMs: clock.now().getTime() - started, outcome: 'failed' });
      throw error instanceof MigrationError ? error : new MigrationError('Migration failed', version, { cause: error });
    }
    logger.info('migration applied', { version, durationMs: clock.now().getTime() - started, outcome: 'ok' });
  };

  if (fromVersion === 0 && pending.length > 0) {
    // Fresh install: schema + seed + versions in one transaction, so an interrupted first launch leaves nothing.
    await timed(latest, () =>
      db.transaction(async (tx) => {
        for (const m of pending) {
          await m.up(tx);
        }
        if (seed) await seed(tx);
        for (const m of pending) {
          await recordVersion(tx, m.version, clock);
        }
      }),
    );
    applied.push(...pending.map((m) => m.version));
    return { fromVersion, toVersion: latest, applied };
  }

  for (const m of pending) {
    await timed(m.version, () =>
      db.transaction(async (tx) => {
        await m.up(tx);
        await recordVersion(tx, m.version, clock);
      }),
    );
    applied.push(m.version);
  }
  if (seed) {
    try {
      await db.transaction(seed);
    } catch (error) {
      throw new MigrationError('Seed failed', latest, { cause: error });
    }
  }
  return { fromVersion, toVersion: latest, applied };
}
