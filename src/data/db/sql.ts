// The data layer's only view of SQLite (DATA-18, ARCH-09). Drivers (expo-sqlite in the app, node:sqlite in Jest)
// implement `SqlDriver`; `createSqlDatabase` adds a serial queue and transactions on the same connection, so the
// connection's pragmas (foreign keys) always apply. Always bind params; never interpolate values into SQL.
import { DatabaseError, isAppError } from '@/shared/errors';

export type SqlValue = string | number | null;
export type SqlParams = readonly SqlValue[];

export interface SqlExecutor {
  /** Runs one or more statements without params (DDL, pragmas). */
  exec(sql: string): Promise<void>;
  run(sql: string, params?: SqlParams): Promise<{ changes: number }>;
  getAll<Row>(sql: string, params?: SqlParams): Promise<Row[]>;
  getFirst<Row>(sql: string, params?: SqlParams): Promise<Row | null>;
}

export interface SqlDatabase extends SqlExecutor {
  /**
   * Runs `task` in `BEGIN IMMEDIATE … COMMIT`; any throw rolls back and rethrows (DATA-01: multi-row writes).
   * Other calls wait until it finishes. Don't call the outer database from inside `task`: use `tx`.
   */
  transaction<T>(task: (tx: SqlExecutor) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

/** Minimal driver surface; no locking or transaction logic. */
export interface SqlDriver extends SqlExecutor {
  close(): Promise<void>;
}

/**
 * ARCH-13: raw driver failures become `DatabaseError` with a static message (the driver's text, which can hold SQL
 * or values, stays on `cause` for dev diagnostics). Typed app errors thrown by callers pass through unchanged.
 */
function toDatabaseError(error: unknown): unknown {
  return isAppError(error) ? error : new DatabaseError('Database operation failed', { cause: error });
}

async function mapped<T>(task: () => Promise<T>): Promise<T> {
  try {
    return await task();
  } catch (error) {
    throw toDatabaseError(error);
  }
}

export function createSqlDatabase(driver: SqlDriver): SqlDatabase {
  let queue: Promise<unknown> = Promise.resolve();

  function serial<T>(task: () => Promise<T>): Promise<T> {
    const result = queue.then(task, task);
    queue = result.catch(() => undefined);
    return result;
  }

  // What a transaction task sees: the raw driver, with its failures mapped too.
  const tx: SqlExecutor = {
    exec: (sql) => mapped(() => driver.exec(sql)),
    run: (sql, params) => mapped(() => driver.run(sql, params)),
    getAll: <Row>(sql: string, params?: SqlParams) => mapped(() => driver.getAll<Row>(sql, params)),
    getFirst: <Row>(sql: string, params?: SqlParams) => mapped(() => driver.getFirst<Row>(sql, params)),
  };

  return {
    exec: (sql) => serial(() => tx.exec(sql)),
    run: (sql, params) => serial(() => tx.run(sql, params)),
    getAll: <Row>(sql: string, params?: SqlParams) => serial(() => tx.getAll<Row>(sql, params)),
    getFirst: <Row>(sql: string, params?: SqlParams) => serial(() => tx.getFirst<Row>(sql, params)),
    transaction: (task) =>
      serial(async () => {
        await tx.exec('BEGIN IMMEDIATE');
        try {
          const value = await task(tx);
          await tx.exec('COMMIT');
          return value;
        } catch (error) {
          await driver.exec('ROLLBACK').catch(() => undefined);
          throw toDatabaseError(error);
        }
      }),
    close: () => serial(() => mapped(() => driver.close())),
  };
}

/** Per-connection setup (ARCH-09): foreign keys on, then WAL where supported. Must run outside a transaction. */
export async function applyConnectionPragmas(db: SqlExecutor): Promise<void> {
  await db.exec('PRAGMA foreign_keys = ON');
  await db.getFirst('PRAGMA journal_mode = WAL');
}
