/// <reference types="node" />
// Jest stand-in for expo-sqlite (jest.setup.ts): the same async API over Node's built-in SQLite, so app startup
// and route tests run real SQL (ARCH-18). Each `openDatabaseAsync` call gets a fresh in-memory database.
import { DatabaseSync } from 'node:sqlite';

type Params = (string | number | null)[];
const plain = (row: unknown) => (row === undefined ? null : { ...(row as Record<string, unknown>) });

export async function openDatabaseAsync(_name: string, _options?: unknown) {
  const db = new DatabaseSync(':memory:');
  return {
    execAsync: async (sql: string) => void db.exec(sql),
    runAsync: async (sql: string, params: Params = []) => {
      const r = db.prepare(sql).run(...params);
      return { changes: Number(r.changes), lastInsertRowId: Number(r.lastInsertRowid) };
    },
    getAllAsync: async (sql: string, params: Params = []) =>
      db
        .prepare(sql)
        .all(...params)
        .map((r: unknown) => plain(r)),
    getFirstAsync: async (sql: string, params: Params = []) => plain(db.prepare(sql).get(...params)),
    closeAsync: async () => void db.close(),
  };
}
