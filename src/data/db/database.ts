// Opens the app database (ARCH-09): expo-sqlite connection → foreign keys ON → WAL → migrations + idempotent seed.
// Failures surface as typed errors for the recovery screen (UX-20); the database is never deleted or reset.
import { openDatabaseAsync, type SQLiteBindValue } from 'expo-sqlite';

import { DatabaseError, MigrationError } from '@/shared/errors';

import { MIGRATIONS } from './migrations';
import { migrate, readSchemaVersion, type MigrationOptions, type MigrationResult } from './migrations/runner';
import { applyConnectionPragmas, createSqlDatabase, type SqlDatabase, type SqlDriver, type SqlParams } from './sql';

export const DATABASE_NAME = 'calorie-tracker.db';

const bind = (params: SqlParams | undefined): SQLiteBindValue[] => (params ? [...params] : []);

async function openExpoSqliteDriver(databaseName: string): Promise<SqlDriver> {
  const db = await openDatabaseAsync(databaseName);
  return {
    exec: (sql) => db.execAsync(sql),
    run: async (sql, params) => {
      const result = await db.runAsync(sql, bind(params));
      return { changes: result.changes };
    },
    getAll: <Row>(sql: string, params?: SqlParams) => db.getAllAsync<Row>(sql, bind(params)),
    getFirst: <Row>(sql: string, params?: SqlParams) => db.getFirstAsync<Row>(sql, bind(params)),
    close: () => db.closeAsync(),
  };
}

/** Pragmas → migrations → seed on an already-open database. Shared by the app and the tests. */
export async function prepareDatabase(db: SqlDatabase, options: MigrationOptions): Promise<MigrationResult> {
  try {
    await applyConnectionPragmas(db);
  } catch (error) {
    throw new DatabaseError('Could not configure the database connection', { cause: error });
  }
  return migrate(db, MIGRATIONS, options);
}

export async function openAppDatabase(options: MigrationOptions): Promise<SqlDatabase> {
  let db: SqlDatabase;
  try {
    db = createSqlDatabase(await openExpoSqliteDriver(DATABASE_NAME));
  } catch (error) {
    throw new DatabaseError('Could not open the database', { cause: error });
  }
  try {
    await prepareDatabase(db, options);
  } catch (error) {
    await db.close().catch(() => undefined);
    throw error instanceof MigrationError || error instanceof DatabaseError
      ? error
      : new DatabaseError('Database startup failed', { cause: error });
  }
  return db;
}

/**
 * ARCH-23: the widget's connection to the app database. Pragmas only — it never migrates or seeds, so a database
 * the app hasn't migrated yet resolves to `null` (UX-22 unavailable) instead of racing the app's startup.
 */
export async function openWidgetDatabase(): Promise<SqlDatabase | null> {
  const db = createSqlDatabase(await openExpoSqliteDriver(DATABASE_NAME));
  try {
    await applyConnectionPragmas(db);
    if ((await readSchemaVersion(db)) === MIGRATIONS.length) return db;
  } catch (error) {
    await db.close().catch(() => undefined);
    throw error;
  }
  await db.close().catch(() => undefined);
  return null;
}
