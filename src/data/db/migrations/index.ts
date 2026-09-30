import { migration001 } from './001_initial';
import { migration002 } from './002_food_search_sections';
import { migration003 } from './003_macro_target_mode';
import { migration004 } from './004_nutrient_catalog';
import type { Migration } from './types';

/** Every migration, in version order. Append only (DATA-17). */
export const MIGRATIONS: readonly Migration[] = [migration001, migration002, migration003, migration004];

export const LATEST_SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1]!.version;

export type { Migration } from './types';
