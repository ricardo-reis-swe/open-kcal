import type { SqlExecutor } from '../sql';

/** A numbered, forward-only migration (DATA-17). `up` runs inside a transaction. */
export type Migration = {
  version: number;
  name: string;
  up: (tx: SqlExecutor) => Promise<void>;
};
