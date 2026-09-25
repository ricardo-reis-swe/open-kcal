/// <reference types="node" />
// Test-only SqlDriver over Node's built-in SQLite, so repository and migration tests run real SQL (ARCH-18)
// without mocking and without an extra dependency. Never imported by app code.
import { DatabaseSync } from 'node:sqlite';

import {
  applyConnectionPragmas,
  createSqlDatabase,
  type SqlDatabase,
  type SqlDriver,
  type SqlParams,
} from '@/data/db/sql';

type Row = Record<string, unknown>;

export function openNodeSqliteDriver(path = ':memory:'): SqlDriver {
  const db = new DatabaseSync(path);
  const args = (params?: SqlParams) => (params ? [...params] : []);
  return {
    exec: async (sql) => {
      db.exec(sql);
    },
    run: async (sql, params) => {
      const result = db.prepare(sql).run(...args(params));
      return { changes: Number(result.changes) };
    },
    // node:sqlite returns null-prototype objects; spread them so Jest equality treats them as plain rows.
    getAll: async <T>(sql: string, params?: SqlParams) =>
      db
        .prepare(sql)
        .all(...args(params))
        .map((r: unknown) => ({ ...(r as Row) }) as T),
    getFirst: async <T>(sql: string, params?: SqlParams) => {
      const row = db.prepare(sql).get(...args(params));
      return row === undefined ? null : ({ ...(row as Row) } as T);
    },
    close: async () => {
      db.close();
    },
  };
}

/** A fresh disposable database with the app's connection pragmas applied. */
export async function openTestDatabase(path?: string): Promise<SqlDatabase> {
  const db = createSqlDatabase(openNodeSqliteDriver(path));
  await applyConnectionPragmas(db);
  return db;
}
