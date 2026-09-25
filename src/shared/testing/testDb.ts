// Seeded disposable databases for repository tests (ARCH-18: real SQL, never a mocked repository).
import { prepareDatabase } from '@/data/db/database';
import { sequentialIds, type IdGenerator } from '@/data/db/ids';
import type { RepositoryDeps } from '@/data/db/repositories/deps';
import { seedDefaults } from '@/data/db/seed';
import { defaultUnitPreferences } from '@/domain/units/units';
import { toLocalDate, type Clock } from '@/shared/dates';

import { openTestDatabase } from './nodeSqlite';

export const TEST_MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'] as const;

/** A settable clock for tests. */
export function testClock(
  start = '2026-09-25T10:00:00.000Z',
): Clock & { set(iso: string): void; advance(ms: number): void } {
  let at = new Date(start).getTime();
  return {
    now: () => new Date(at),
    set: (iso) => {
      at = new Date(iso).getTime();
    },
    advance: (ms) => {
      at += ms;
    },
  };
}

export async function openSeededTestDatabase(
  options: { clock?: ReturnType<typeof testClock>; ids?: IdGenerator } = {},
): Promise<RepositoryDeps & { clock: ReturnType<typeof testClock> }> {
  const clock = options.clock ?? testClock();
  const ids = options.ids ?? sequentialIds();
  const db = await openTestDatabase();
  await prepareDatabase(db, {
    clock,
    logger: { info: () => undefined, error: () => undefined },
    seed: async (tx) =>
      void (await seedDefaults(tx, {
        now: clock.now().toISOString(),
        today: toLocalDate(clock.now()),
        units: defaultUnitPreferences('metric'),
        mealNames: TEST_MEALS,
        ids,
      })),
  });
  return { db, clock, ids };
}
