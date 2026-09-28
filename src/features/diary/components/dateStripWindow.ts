import { addDays, daysBetween, type LocalDate } from '@/shared/dates';

/**
 * UX-02 scrollable date strip: the days it holds are a bounded window (no date bounds exist in NAV/DATA), so the
 * list is never unbounded. The window grows by `EXTEND` days when the user scrolls near an end and is re-anchored
 * around the selected date when a selection lands near (or beyond) an edge, e.g. from the Date Picker.
 */
export type StripWindow = { start: LocalDate; length: number };

export const RADIUS = 60;
export const EXTEND = 60;
export const MARGIN = 7;

export function windowAround(date: LocalDate): StripWindow {
  return { start: addDays(date, -RADIUS), length: RADIUS * 2 + 1 };
}

export function windowDates({ start, length }: StripWindow): LocalDate[] {
  return Array.from({ length }, (_, i) => addDays(start, i));
}

export function indexInWindow(window: StripWindow, date: LocalDate): number {
  return daysBetween(window.start, date);
}

/** True when `date` is outside the window or within `MARGIN` days of either end. */
export function needsReanchor(window: StripWindow, date: LocalDate): boolean {
  const index = indexInWindow(window, date);
  return index < MARGIN || index > window.length - 1 - MARGIN;
}

export function extendStart(window: StripWindow): StripWindow {
  return { start: addDays(window.start, -EXTEND), length: window.length + EXTEND };
}

export function extendEnd(window: StripWindow): StripWindow {
  return { start: window.start, length: window.length + EXTEND };
}

/** Scroll offset that centers item `index` (fixed `itemWidth`) in a list `listWidth` wide, clamped at 0. */
export function centerOffset(index: number, itemWidth: number, listWidth: number): number {
  return Math.max(0, index * itemWidth + itemWidth / 2 - listWidth / 2);
}
