import { toLocalDate } from '@/shared/dates';
import { openSeededTestDatabase } from '@/shared/testing/testDb';

import { createWeightRepository } from '../weightRepository';

// TZ=Europe/Lisbon (jest.config.js); the seeded clock is 2026-09-25T10:00Z = 11:00 local.
async function setup() {
  const deps = await openSeededTestDatabase();
  return { deps, weight: createWeightRepository(deps) };
}

describe('DATA-13: weight repository', () => {
  it('today uses the current time; a past date uses local noon; measured_at and local_date agree', async () => {
    const { weight } = await setup();
    const today = await weight.add({ localDate: '2026-09-25', weightKg: 72.4 });
    expect(today).toMatchObject({ measuredAt: '2026-09-25T10:00:00.000Z', localDate: '2026-09-25' });
    const past = await weight.add({ localDate: '2026-09-20', weightKg: 73 });
    expect(past.measuredAt).toBe('2026-09-20T11:00:00.000Z'); // 12:00 WEST
    expect(toLocalDate(new Date(past.measuredAt))).toBe(past.localDate);
  });

  it('rejects future dates and non-positive weights', async () => {
    const { weight } = await setup();
    await expect(weight.add({ localDate: '2026-09-26', weightKg: 70 })).rejects.toMatchObject({
      fields: ['localDate'],
    });
    await expect(weight.add({ localDate: '2026-09-25', weightKg: 0 })).rejects.toMatchObject({ fields: ['weightKg'] });
  });

  it('current = latest measured_at, tie-break created_at; several per day; list newest first', async () => {
    const { deps, weight } = await setup();
    const a = await weight.add({ localDate: '2026-09-25', weightKg: 72 });
    deps.clock.advance(1000);
    const b = await weight.add({ localDate: '2026-09-25', weightKg: 71.8 });
    await weight.add({ localDate: '2026-09-01', weightKg: 75 });
    expect((await weight.current())?.id).toBe(b.id);
    expect((await weight.list()).map((w) => w.weightKg)).toEqual([71.8, 72, 75]);
    // Same measured_at: the later created_at wins.
    await deps.db.run('UPDATE weight_entries SET measured_at = ? WHERE id = ?', [a.measuredAt, b.id]);
    expect((await weight.current())?.id).toBe(b.id);
  });

  it('update keeps the time for the same date and re-derives it for a new date; delete recomputes current', async () => {
    const { deps, weight } = await setup();
    const w = await weight.add({ localDate: '2026-09-25', weightKg: 72 });
    deps.clock.advance(3_600_000);
    expect(await weight.update(w.id, { localDate: '2026-09-25', weightKg: 71 })).toMatchObject({
      measuredAt: w.measuredAt,
      weightKg: 71,
    });
    expect(await weight.update(w.id, { localDate: '2026-09-24', weightKg: 71 })).toMatchObject({
      measuredAt: '2026-09-24T11:00:00.000Z',
      localDate: '2026-09-24',
    });
    const older = await weight.add({ localDate: '2026-09-10', weightKg: 74 });
    await weight.delete(w.id);
    expect((await weight.current())?.id).toBe(older.id);
    await expect(weight.delete(w.id)).rejects.toMatchObject({ category: 'not_found' });
  });
});
