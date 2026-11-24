// Opens the app database (ARCH-09): expo-sqlite connection → foreign keys ON → WAL → migrations + idempotent seed.
// Failures surface as typed errors for the recovery screen (UX-20); the database is never deleted or reset.
import { defaultDatabaseDirectory, openDatabaseAsync, type SQLiteBindValue, type SQLiteOpenOptions } from 'expo-sqlite';

import { DatabaseError, MigrationError } from '@/shared/errors';

import { MIGRATIONS } from './migrations';
import { migrate, readSchemaVersion, type MigrationOptions, type MigrationResult } from './migrations/runner';
import { applyConnectionPragmas, createSqlDatabase, type SqlDatabase, type SqlDriver, type SqlParams } from './sql';

export const DATABASE_NAME = 'calorie-tracker.db';

/** Where a database file lives: a plain absolute directory path (no `file://`) and the file name. */
export type DatabaseLocation = { directory: string; name: string };

/** ARCH-25: the app database's location. A plain path on both platforms (Android `filesDir/SQLite`, iOS `Documents/SQLite`). */
export function appDatabaseLocation(): DatabaseLocation {
  return { directory: String(defaultDatabaseDirectory).replace(/\/+$/, ''), name: DATABASE_NAME };
}

const bind = (params: SqlParams | undefined): SQLiteBindValue[] => (params ? [...params] : []);

/** The expo-sqlite driver adapter. Also used by the DATA-31 import checks on a staged file (`directory`). */
export async function openExpoSqliteDriver(
  databaseName: string,
  options?: SQLiteOpenOptions,
  directory?: string,
): Promise<SqlDriver> {
  const db = await openDatabaseAsync(databaseName, options, directory);
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

export async function openAppDatabase(
  options: MigrationOptions,
  location: DatabaseLocation = appDatabaseLocation(),
): Promise<SqlDatabase> {
  let db: SqlDatabase;
  try {
    db = createSqlDatabase(await openExpoSqliteDriver(location.name, undefined, location.directory));
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
 * ARCH-23: the widget's own read-only connection to the app database. It never migrates or seeds, so a database
 * the app hasn't migrated yet resolves to `null` (UX-22 unavailable) instead of racing the app's startup.
 */
export async function openWidgetDatabase(): Promise<SqlDatabase | null> {
  // Its own connection: expo-sqlite otherwise hands back the app's cached one, which `close()` would shut.
  const db = createSqlDatabase(await openExpoSqliteDriver(DATABASE_NAME, { useNewConnection: true }), {
    readOnly: true,
  });
  try {
    // Reads only, on a file the app already put in WAL mode: just wait out a concurrent app write.
    await db.exec('PRAGMA busy_timeout = 2000');
    if ((await readSchemaVersion(db)) === MIGRATIONS.length) return db; // every migration applied
  } catch (error) {
    await db.close().catch(() => undefined);
    throw error;
  }
  await db.close().catch(() => undefined);
  return null;
}
