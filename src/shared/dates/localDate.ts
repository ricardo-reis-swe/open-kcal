// Local calendar dates and UTC event timestamps (DATA-08). Pure: no React, Expo or SQLite.
// Diary dates are local `YYYY-MM-DD` strings and are never stored as UTC midnight (that shifts the day).
import { z } from 'zod';

/** Local calendar date, `YYYY-MM-DD`. */
export type LocalDate = string;
/** UTC ISO-8601 timestamp with milliseconds, e.g. `2026-09-25T14:32:18.123Z`. */
export type UtcIso = string;

const LOCAL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const UTC_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function parts(date: LocalDate): { y: number; m: number; d: number } | null {
  const match = LOCAL_DATE.exec(date);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  // Round-trip through UTC so 2026-02-30 or 2026-13-01 are rejected.
  const check = new Date(Date.UTC(y, m - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) return null;
  return { y, m, d };
}

function mustParse(date: LocalDate): { y: number; m: number; d: number } {
  const p = parts(date);
  if (!p) throw new RangeError('Invalid local date');
  return p;
}

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

export function isLocalDate(value: string): boolean {
  return parts(value) !== null;
}

export const localDateSchema = z.string().refine(isLocalDate, 'Expected a YYYY-MM-DD calendar date');
export const utcIsoSchema = z.string().regex(UTC_ISO, 'Expected a UTC ISO-8601 timestamp with ms');

/** The device-local calendar date of an instant. */
export function toLocalDate(instant: Date): LocalDate {
  return `${pad(instant.getFullYear(), 4)}-${pad(instant.getMonth() + 1)}-${pad(instant.getDate())}`;
}

export function toUtcIso(instant: Date): UtcIso {
  return instant.toISOString();
}

/** Calendar arithmetic in UTC, so a DST change can never skip or repeat a day. */
export function addDays(date: LocalDate, days: number): LocalDate {
  const { y, m, d } = mustParse(date);
  const next = new Date(Date.UTC(y, m - 1, d + days));
  return `${pad(next.getUTCFullYear(), 4)}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`;
}

/** Whole calendar days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: LocalDate, to: LocalDate): number {
  const a = mustParse(from);
  const b = mustParse(to);
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86_400_000);
}

/** `YYYY-MM-DD` strings sort lexically in calendar order. */
export function compareLocalDates(a: LocalDate, b: LocalDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** The instant of a local wall-clock time on a local date, in the device timezone. */
export function localDateTime(date: LocalDate, hours: number, minutes = 0): Date {
  const { y, m, d } = mustParse(date);
  return new Date(y, m - 1, d, hours, minutes, 0, 0);
}
