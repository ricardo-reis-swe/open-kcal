import { toLocalDate } from '@/shared/dates';

import { currentWeight, isAllowedWeightDate, measuredAtForDate } from '../weight';

describe('DATA-13: weight', () => {
  it('current weight = latest measured_at, tie-break created_at', () => {
    const entries = [
      { id: 'a', measuredAt: '2026-09-24T08:00:00.000Z', createdAt: '2026-09-24T08:00:01.000Z' },
      { id: 'b', measuredAt: '2026-09-25T08:00:00.000Z', createdAt: '2026-09-25T08:00:01.000Z' },
      { id: 'c', measuredAt: '2026-09-25T08:00:00.000Z', createdAt: '2026-09-25T09:00:00.000Z' },
      { id: 'd', measuredAt: '2026-09-23T08:00:00.000Z', createdAt: '2026-09-26T08:00:00.000Z' },
    ];
    expect(currentWeight(entries)?.id).toBe('c');
    expect(currentWeight([])).toBeNull();
  });

  it('a date-only sheet uses now for today and local noon otherwise; measured_at and local_date agree', () => {
    // TZ=Europe/Lisbon (jest.config.js). 23:30 UTC on the 25th is already the 26th locally.
    const now = new Date('2026-09-25T23:30:00.000Z');
    expect(measuredAtForDate('2026-09-26', now)).toBe(now);
    const past = measuredAtForDate('2026-09-25', now);
    expect(past.toISOString()).toBe('2026-09-25T11:00:00.000Z'); // local noon, not now
    expect(toLocalDate(past)).toBe('2026-09-25');
    // DST start (2026-03-29): noon still lands on that date.
    expect(toLocalDate(measuredAtForDate('2026-03-29', now))).toBe('2026-03-29');
  });

  it('local_date must not be after today', () => {
    expect(isAllowedWeightDate('2026-09-25', '2026-09-25')).toBe(true);
    expect(isAllowedWeightDate('2026-09-26', '2026-09-25')).toBe(false);
  });
});
