import type { Clock } from '@/shared/dates';

import type { IdGenerator } from '../ids';
import type { SqlDatabase } from '../sql';

/** What every SQLite repository needs (ARCH-04 infrastructure). */
export type RepositoryDeps = { db: SqlDatabase; clock: Clock; ids: IdGenerator };
