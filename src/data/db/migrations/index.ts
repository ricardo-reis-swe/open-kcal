import { migration001 } from './001_initial';
import type { Migration } from './types';

/** Every migration, in version order. Append only (DATA-17). */
export const MIGRATIONS: readonly Migration[] = [migration001];

export const LATEST_SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1]!.version;

export type { Migration } from './types';
