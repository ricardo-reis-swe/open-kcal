// DATA-31 Import validation. The picked file is staged in the cache; every check runs on the staged copy, on its own
// connection, so the live database is untouched until DATA-32. Not a repository: only src/data/db runs SQL (DATA-18).
import type { LocalDate, Clock } from '@/shared/dates';
import { DatabaseError, ValidationError, isAppError, type ImportRejectReason } from '@/shared/errors';
import type { Logger } from '@/shared/logging/logger';

import { openExpoSqliteDriver } from '../database';
import { LATEST_SCHEMA_VERSION, MIGRATIONS } from '../migrations';
import { migrate, readSchemaVersion } from '../migrations/runner';
import { createSqlDatabase, type SqlDatabase } from '../sql';
import { sizeBucket } from './exportDatabase';
import { cacheDirectory, copy, ensureDir, move, readHead, remove, removeDir, size, toPath } from './files';

export const MAX_IMPORT_BYTES = 200 * 1024 * 1024;

export type ImportSummary = { schemaVersion: number; entryCount: number; latestDiaryDate: LocalDate | null };

export const importDirectory = () => `${cacheDirectory()}/import`;
const STAGED_NAME = 'staged.db';

/** DATA-31 check 6: tables a file at `version` must have. */
export const REQUIRED_TABLES: readonly { fromVersion: number; tables: readonly string[] }[] = [
  {
    fromVersion: 1,
    tables: [
      'schema_version',
      'app_settings',
      'nutrition_goals',
      'meals',
      'foods',
      'food_servings',
      'diary_entries',
      'weight_entries',
      'recent_foods',
      'food_cache_metadata',
    ],
  },
  { fromVersion: 4, tables: ['food_nutrients', 'diary_entry_nutrients'] },
  { fromVersion: 7, tables: ['recipes', 'recipe_ingredients'] },
];

const SQLITE_MAGIC = Uint8Array.from([
  0x53, 0x51, 0x4c, 0x69, 0x74, 0x65, 0x20, 0x66, 0x6f, 0x72, 0x6d, 0x61, 0x74, 0x20, 0x33, 0x00,
]); // "SQLite format 3\0"

/** The same message for every reason (ARCH-13); callers branch on `reason`. */
const reject = (reason: ImportRejectReason, cause?: unknown) =>
  new ValidationError('Import rejected', [], { reason, cause });

/** Removes the staged copy and its folder (DATA-32: after success, failure or cancel). */
export async function discardStagedImport(): Promise<void> {
  await removeDir(importDirectory());
}

/** Removes the picker's cache copy of a file that was never staged (the screen was left while picking). */
export async function discardPickedFile(pickedUri: string): Promise<void> {
  await remove(toPath(pickedUri));
}

type Deps = {
  clock: Clock;
  logger: Pick<Logger, 'info' | 'error'>;
  /** The picker's reported size, when it has one: checked before any copy. */
  size?: number | null;
  maxBytes?: number;
};

/** A structural fingerprint (not `sql` text), so reformatted migration text never rejects an old install's export. */
async function schemaFingerprint(db: SqlDatabase): Promise<string[]> {
  const lines: string[] = [];
  const objects = await db.getAll<{ type: string; name: string; tbl_name: string }>(
    "SELECT type, name, tbl_name FROM sqlite_master WHERE substr(name, 1, 7) <> 'sqlite_'",
  );
  for (const o of objects) lines.push(`object|${o.type}|${o.name}|${o.tbl_name}`);
  const tables = await db.getAll<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND substr(name, 1, 7) <> 'sqlite_'",
  );
  for (const { name } of tables) {
    const columns = await db.getAll<{
      name: string;
      type: string;
      notnull: number;
      dflt_value: string | null;
      pk: number;
    }>('SELECT name, type, "notnull", dflt_value, pk FROM pragma_table_info(?)', [name]);
    for (const c of columns)
      lines.push(`column|${name}|${c.name}|${c.type}|${c.notnull}|${c.dflt_value ?? '<null>'}|${c.pk}`);
    const indexes = await db.getAll<{ name: string; unique: number }>(
      'SELECT name, "unique" FROM pragma_index_list(?)',
      [name],
    );
    for (const index of indexes) {
      const cols = await db.getAll<{ name: string | null }>('SELECT name FROM pragma_index_info(?) ORDER BY seqno', [
        index.name,
      ]);
      lines.push(`index|${name}|${index.name}|${index.unique}|${cols.map((c) => c.name ?? '<expr>').join(',')}`);
    }
    const keys = await db.getAll<{ table: string; from: string; to: string | null; on_delete: string }>(
      'SELECT "table", "from", "to", on_delete FROM pragma_foreign_key_list(?)',
      [name],
    );
    for (const k of keys) lines.push(`fk|${name}|${k.table}|${k.from}|${k.to ?? '<null>'}|${k.on_delete}`);
  }
  return lines.sort();
}

/** What a fresh database built from MIGRATIONS looks like (check 8). */
async function referenceFingerprint(deps: Pick<Deps, 'clock' | 'logger'>): Promise<string[]> {
  const reference = createSqlDatabase(await openExpoSqliteDriver(':memory:', { useNewConnection: true }));
  try {
    await migrate(reference, MIGRATIONS, {
      clock: deps.clock,
      logger: { info: () => undefined, error: () => undefined },
    });
    return await schemaFingerprint(reference);
  } finally {
    await reference.close().catch(() => undefined);
  }
}

async function runChecks(stagedPath: string, deps: Deps): Promise<ImportSummary> {
  // 2: header
  let head: Uint8Array;
  try {
    head = await readHead(stagedPath, 16);
  } catch (cause) {
    throw cause instanceof DatabaseError ? cause : new DatabaseError('File operation failed', { cause });
  }
  if (head.length < 16 || SQLITE_MAGIC.some((byte, i) => head[i] !== byte)) throw reject('notSqlite');

  // 3: opens, integrity, foreign keys. A single-file DB (DELETE journal), so there are no -wal/-shm files to carry.
  let staged: SqlDatabase | null = null;
  try {
    try {
      staged = createSqlDatabase(
        await openExpoSqliteDriver(STAGED_NAME, { useNewConnection: true }, importDirectory()),
      );
      await staged.getFirst('PRAGMA journal_mode = DELETE');
      const integrity = await staged.getAll<Record<string, unknown>>('PRAGMA integrity_check');
      if (integrity.length === 0 || integrity.some((row) => Object.values(row)[0] !== 'ok')) throw reject('corrupt');
      const violations = await staged.getAll('PRAGMA foreign_key_check');
      if (violations.length > 0) throw reject('corrupt');
    } catch (cause) {
      throw cause instanceof ValidationError ? cause : reject('corrupt', cause);
    }

    // 4–6: it is an Open Kcal database of a version we can read.
    let schemaVersion: number;
    try {
      schemaVersion = await readSchemaVersion(staged);
      if (schemaVersion < 1) throw reject('notOpenKcal');
      if (schemaVersion > LATEST_SCHEMA_VERSION) throw reject('newerVersion');
      const present = new Set(
        (await staged.getAll<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'")).map(
          (r) => r.name,
        ),
      );
      const missing = REQUIRED_TABLES.filter((group) => schemaVersion >= group.fromVersion).some((group) =>
        group.tables.some((table) => !present.has(table)),
      );
      if (missing) throw reject('notOpenKcal');
    } catch (cause) {
      throw cause instanceof ValidationError ? cause : reject('corrupt', cause);
    }

    // 7: migrate the staged copy (no seed), so a migration failure never touches the live database.
    try {
      await staged.exec('PRAGMA foreign_keys = ON');
      await migrate(staged, MIGRATIONS, { clock: deps.clock, logger: deps.logger });
    } catch (cause) {
      throw reject('migrationFailed', cause);
    }

    // 8: its schema equals a fresh database built from MIGRATIONS.
    let same: boolean;
    try {
      const [actual, expected] = [await schemaFingerprint(staged), await referenceFingerprint(deps)];
      same = actual.length === expected.length && actual.every((line, i) => line === expected[i]);
    } catch (cause) {
      throw reject('corrupt', cause);
    }
    if (!same) throw reject('notOpenKcal');

    // 9: exactly one settings row and at least one meal.
    let shape: [number, number];
    let summary: { n: number; latest: string | null } | null;
    try {
      const settings = await staged.getFirst<{ n: number }>('SELECT COUNT(*) AS n FROM app_settings');
      const meals = await staged.getFirst<{ n: number }>('SELECT COUNT(*) AS n FROM meals');
      shape = [settings?.n ?? 0, meals?.n ?? 0];
      summary = await staged.getFirst<{ n: number; latest: string | null }>(
        'SELECT COUNT(*) AS n, MAX(diary_date) AS latest FROM diary_entries',
      );
    } catch (cause) {
      throw reject('corrupt', cause);
    }
    if (shape[0] !== 1 || shape[1] < 1) throw reject('notOpenKcal');

    return {
      schemaVersion,
      entryCount: summary?.n ?? 0,
      latestDiaryDate: (summary?.latest ?? null) as LocalDate | null,
    };
  } finally {
    if (staged) await staged.close().catch(() => undefined);
  }
}

/**
 * Stages the picked file (already copied into the cache by the picker) and runs checks 1–9. Resolves with the
 * summary for the confirm dialog; on any failure the staged copy is removed and the error is thrown.
 */
export async function stageImport(
  pickedUri: string,
  deps: Deps,
): Promise<{ stagedPath: string; summary: ImportSummary }> {
  const started = deps.clock.now().getTime();
  const maxBytes = deps.maxBytes ?? MAX_IMPORT_BYTES;
  const dir = importDirectory();
  const stagedPath = `${dir}/${STAGED_NAME}`;
  const pickedPath = toPath(pickedUri);
  let bucket: string | undefined;
  try {
    await removeDir(dir);
    await ensureDir(dir);

    // 1: size, from the picker when it knew it (before any copy), else from the file.
    const bytes = deps.size ?? (await size(pickedPath));
    bucket = sizeBucket(bytes);
    if (bytes === 0) throw reject('empty');
    if (bytes > maxBytes) throw reject('tooLarge');

    try {
      await move(pickedPath, stagedPath);
    } catch {
      await copy(pickedPath, stagedPath);
      await remove(pickedPath).catch(() => undefined);
    }

    const summary = await runChecks(stagedPath, deps);
    deps.logger.info('import checked', {
      outcome: 'ok',
      schemaVersion: summary.schemaVersion,
      sizeBucket: bucket,
      durationMs: deps.clock.now().getTime() - started,
    });
    return { stagedPath, summary };
  } catch (error) {
    await discardStagedImport().catch(() => undefined);
    // The picker's cache copy is ours (copyToCacheDirectory), and can be large: it must not outlive a rejection.
    await remove(pickedPath).catch(() => undefined);
    deps.logger.info('import checked', {
      outcome: 'rejected',
      reason: error instanceof ValidationError ? error.reason : undefined,
      sizeBucket: bucket,
      durationMs: deps.clock.now().getTime() - started,
    });
    throw error instanceof ValidationError || isAppError(error)
      ? error
      : new DatabaseError('File operation failed', { cause: error });
  }
}
