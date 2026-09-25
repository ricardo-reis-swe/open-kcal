import {
  addDays,
  compareLocalDates,
  daysBetween,
  fixedClock,
  isLocalDate,
  localDateSchema,
  localDateTime,
  nowUtcIso,
  toLocalDate,
  todayLocal,
  utcIsoSchema,
} from '..';

// jest.config.js pins TZ=Europe/Lisbon (WET/WEST; DST 2026-03-29 and 2026-10-25).

describe('DATA-08: local dates', () => {
  it('validates real calendar dates only', () => {
    expect(isLocalDate('2026-09-25')).toBe(true);
    expect(isLocalDate('2028-02-29')).toBe(true);
    expect(isLocalDate('2026-02-29')).toBe(false);
    expect(isLocalDate('2026-13-01')).toBe(false);
    expect(isLocalDate('2026-9-25')).toBe(false);
    expect(isLocalDate('2026-09-25T00:00:00Z')).toBe(false);
    expect(localDateSchema.safeParse('2026-04-31').success).toBe(false);
  });

  it('crosses month and year ends', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('handles leap days', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2028-02-29', 1)).toBe('2028-03-01');
    expect(addDays('2100-02-28', 1)).toBe('2100-03-01'); // not a leap year
    expect(addDays('2000-02-28', 1)).toBe('2000-02-29'); // leap year
    expect(daysBetween('2028-02-01', '2028-03-01')).toBe(29);
  });

  it('never skips or repeats a day across DST changes', () => {
    // Walk a full year one day at a time: each step moves exactly one calendar day.
    let date = '2026-01-01';
    for (let i = 0; i < 365; i++) {
      const next = addDays(date, 1);
      expect(daysBetween(date, next)).toBe(1);
      date = next;
    }
    expect(date).toBe('2027-01-01');
    expect(addDays('2026-03-28', 1)).toBe('2026-03-29'); // spring forward (23 h day)
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30');
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26'); // fall back (25 h day)
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2);
  });

  it('derives the local date from the device timezone, not UTC', () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('Europe/Lisbon');
    // 23:30 UTC in summer is 00:30 the next day in Lisbon (WEST, UTC+1).
    expect(toLocalDate(new Date('2026-09-25T23:30:00.000Z'))).toBe('2026-09-26');
    // In winter Lisbon is UTC+0, so the same UTC time stays on the same day.
    expect(toLocalDate(new Date('2026-12-25T23:30:00.000Z'))).toBe('2026-12-25');
    // A diary date is never UTC midnight: local midnight on 2026-09-25 is 23:00 UTC on the 24th.
    expect(localDateTime('2026-09-25', 0).toISOString()).toBe('2026-09-24T23:00:00.000Z');
    expect(toLocalDate(localDateTime('2026-09-25', 0))).toBe('2026-09-25');
  });

  it('builds local wall-clock instants on DST days', () => {
    const noon = localDateTime('2026-03-29', 12);
    expect(noon.toISOString()).toBe('2026-03-29T11:00:00.000Z'); // WEST, UTC+1
    expect(toLocalDate(noon)).toBe('2026-03-29');
    expect(localDateTime('2026-10-25', 12).toISOString()).toBe('2026-10-25T12:00:00.000Z'); // back to WET
  });

  it('compares dates in calendar order', () => {
    expect(compareLocalDates('2026-09-25', '2026-10-01')).toBe(-1);
    expect(compareLocalDates('2026-10-01', '2026-09-25')).toBe(1);
    expect(compareLocalDates('2026-09-25', '2026-09-25')).toBe(0);
  });

  it('reads today and UTC timestamps from an injected clock', () => {
    const clock = fixedClock('2026-09-25T23:30:00.000Z'); // 00:30 on the 26th in Lisbon (WEST)
    expect(todayLocal(clock)).toBe('2026-09-26');
    expect(nowUtcIso(clock)).toBe('2026-09-25T23:30:00.000Z');
    expect(utcIsoSchema.safeParse(nowUtcIso(clock)).success).toBe(true);
    expect(utcIsoSchema.safeParse('2026-09-25T23:30:00Z').success).toBe(false);
  });
});
