// Locale number and date display (UX-00 number display, ARCH-22). Pure: callers pass the formatting locale.
import { energyFromKcal, type EnergyUnit } from '@/domain/units/units';
import { daysBetween, type LocalDate } from '@/shared/dates';

const integerFormats = new Map<string, Intl.NumberFormat>();
const decimalFormats = new Map<string, Intl.NumberFormat>();

function integerFormat(locale: string): Intl.NumberFormat {
  let format = integerFormats.get(locale);
  if (!format) {
    format = new Intl.NumberFormat(locale, { maximumFractionDigits: 0, useGrouping: true });
    integerFormats.set(locale, format);
  }
  return format;
}

function decimalFormat(locale: string): Intl.NumberFormat {
  let format = decimalFormats.get(locale);
  if (!format) {
    format = new Intl.NumberFormat(locale, { maximumFractionDigits: 1, useGrouping: true });
    decimalFormats.set(locale, format);
  }
  return format;
}

export function formatInteger(value: number, locale: string): string {
  // `+ 0` turns a rounded -0 into 0, so a tiny negative never shows as "-0".
  return integerFormat(locale).format(Math.round(value) + 0);
}

/** UX-00: kcal/kJ as grouped integers, converted from canonical kcal (DATA-04). */
export function formatEnergy(kcal: number, unit: EnergyUnit, locale: string): string {
  return formatInteger(energyFromKcal(kcal, unit), locale);
}

/** UX-00: macros as integers at ≥10 g and with 1 decimal below 10 g. */
export function formatGrams(grams: number, locale: string): string {
  const tenths = Math.round(grams * 10) / 10;
  return Math.abs(tenths) >= 10 ? formatInteger(grams, locale) : decimalFormat(locale).format(tenths + 0);
}

export type RelativeDay = 'yesterday' | 'today' | 'tomorrow';

/** UX-02: Yesterday/Today/Tomorrow within ±1 day of today, otherwise `null` (use `formatShortDate`). */
export function relativeDay(date: LocalDate, today: LocalDate): RelativeDay | null {
  switch (daysBetween(today, date)) {
    case -1:
      return 'yesterday';
    case 0:
      return 'today';
    case 1:
      return 'tomorrow';
    default:
      return null;
  }
}

/** UX-02: locale short date (`Mon 28 Sep`), with the year only when it isn't the current year. */
export function formatShortDate(date: LocalDate, today: LocalDate, locale: string): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const sameYear = date.slice(0, 4) === today.slice(0, 4);
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

/** UX-03: locale long date (`Friday, 25 September`), with the year only when it isn't the current year. */
export function formatLongDate(date: LocalDate, today: LocalDate, locale: string): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const sameYear = date.slice(0, 4) === today.slice(0, 4);
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    ...(sameYear ? {} : { year: 'numeric' }),
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, d)));
}
