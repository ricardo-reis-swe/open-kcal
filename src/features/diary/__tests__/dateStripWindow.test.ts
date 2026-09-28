import {
  centerOffset,
  extendEnd,
  extendStart,
  indexInWindow,
  MARGIN,
  needsReanchor,
  RADIUS,
  windowAround,
  windowDates,
} from '../components/dateStripWindow';

describe('UX-02 date strip window', () => {
  const window = windowAround('2026-09-28');

  it('UX-02: is bounded and centered on the date, across month/DST boundaries', () => {
    const dates = windowDates(window);
    expect(dates).toHaveLength(RADIUS * 2 + 1);
    expect(dates[RADIUS]).toBe('2026-09-28');
    expect(indexInWindow(window, '2026-09-28')).toBe(RADIUS);
    expect(dates).toContain('2026-10-25'); // Lisbon DST end: one entry per calendar day
    expect(new Set(dates).size).toBe(dates.length);
  });

  it('UX-02: re-anchors only near or past an edge', () => {
    expect(needsReanchor(window, '2026-09-29')).toBe(false);
    expect(needsReanchor(window, windowDates(window)[MARGIN]!)).toBe(false);
    expect(needsReanchor(window, windowDates(window)[MARGIN - 1]!)).toBe(true);
    expect(needsReanchor(window, '2027-03-01')).toBe(true);
    expect(needsReanchor(window, '2020-01-01')).toBe(true);
  });

  it('UX-02: extends at either end without moving existing dates', () => {
    const before = extendStart(window);
    expect(windowDates(before).slice(-window.length)).toEqual(windowDates(window));
    const after = extendEnd(window);
    expect(windowDates(after).slice(0, window.length)).toEqual(windowDates(window));
  });

  it('UX-02: centers an item, clamped at the start', () => {
    expect(centerOffset(10, 100, 300)).toBe(900);
    expect(centerOffset(0, 100, 300)).toBe(0);
  });
});
