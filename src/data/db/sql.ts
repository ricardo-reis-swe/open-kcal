// The data layer's only view of SQLite (DATA-18, ARCH-09). Drivers (expo-sqlite in the app, node:sqlite in Jest)
// implement `SqlDriver`; `createSqlDatabase` adds a serial queue and transactions on the same connection, so the
// connection's pragmas (foreign keys) always apply. Always bind params; never interpolate values into SQL.

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

export function createSqlDatabase(driver: SqlDriver): SqlDatabase {
  let queue: Promise<unknown> = Promise.resolve();

  function serial<T>(task: () => Promise<T>): Promise<T> {
    const result = queue.then(task, task);
    queue = result.catch(() => undefined);
    return result;
  }

  return {
    exec: (sql) => serial(() => driver.exec(sql)),
    run: (sql, params) => serial(() => driver.run(sql, params)),
    getAll: <Row>(sql: string, params?: SqlParams) => serial(() => driver.getAll<Row>(sql, params)),
    getFirst: <Row>(sql: string, params?: SqlParams) => serial(() => driver.getFirst<Row>(sql, params)),
    transaction: (task) =>
      serial(async () => {
        await driver.exec('BEGIN IMMEDIATE');
        try {
          const value = await task(driver);
          await driver.exec('COMMIT');
          return value;
        } catch (error) {
          await driver.exec('ROLLBACK').catch(() => undefined);
          throw error;
        }
      }),
    close: () => serial(() => driver.close()),
  };
}

/** Per-connection setup (ARCH-09): foreign keys on, then WAL where supported. Must run outside a transaction. */
export async function applyConnectionPragmas(db: SqlExecutor): Promise<void> {
  await db.exec('PRAGMA foreign_keys = ON');
  await db.getFirst('PRAGMA journal_mode = WAL');
}
