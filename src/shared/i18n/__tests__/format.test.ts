import { formatEnergy, formatGrams, formatShortDate, relativeDay } from '../format';

describe('UX-00 number display', () => {
  it('UX-00: energy is a grouped integer in the locale', () => {
    expect(formatEnergy(1731.4, 'kcal', 'en-GB')).toBe('1,731');
    expect(formatEnergy(12345.6, 'kcal', 'pt-PT')).toBe('12 346'.replace(' ', ' '));
  });

  it('UX-00 / DATA-04: kJ is converted from canonical kcal', () => {
    expect(formatEnergy(100, 'kJ', 'en-GB')).toBe('418');
  });

  it('UX-00: macros are integers at ≥10 g and 1 decimal below', () => {
    expect(formatGrams(82.4, 'en-GB')).toBe('82');
    expect(formatGrams(4.56, 'en-GB')).toBe('4.6');
    expect(formatGrams(4.56, 'pt-PT')).toBe('4,6');
    expect(formatGrams(9.96, 'en-GB')).toBe('10');
    expect(formatGrams(0, 'en-GB')).toBe('0');
    expect(formatGrams(-0.01, 'en-GB')).toBe('0');
  });
});

describe('UX-02 date labels', () => {
  it('UX-02: Yesterday/Today/Tomorrow within ±1 day, including month and year ends', () => {
    expect(relativeDay('2026-09-24', '2026-09-25')).toBe('yesterday');
    expect(relativeDay('2026-09-25', '2026-09-25')).toBe('today');
    expect(relativeDay('2027-01-01', '2026-12-31')).toBe('tomorrow');
    expect(relativeDay('2026-09-27', '2026-09-25')).toBeNull();
  });

  // ICU versions differ on commas and `Sep`/`Sept`, so the checks allow both.
  it('UX-02: short date, with the year only outside the current year', () => {
    expect(formatShortDate('2026-09-28', '2026-09-25', 'en-GB')).toMatch(/^Mon,? 28 Sept?$/);
    expect(formatShortDate('2025-09-28', '2026-09-25', 'en-GB')).toMatch(/^Sun,? 28 Sept? 2025$/);
    expect(formatShortDate('2026-09-28', '2026-09-25', 'pt-PT')).toMatch(/28/);
  });
});
