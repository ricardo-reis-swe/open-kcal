// Body weight rules (DATA-13). Canonical kg; conversions live in domain/units.
import { localDateTime, toLocalDate, type LocalDate, type UtcIso } from '@/shared/dates';

export type WeightEntry = {
  id: string;
  measuredAt: UtcIso;
  localDate: LocalDate;
  weightKg: number;
  createdAt: UtcIso;
};

/** Current weight = latest `measuredAt`, tie-break latest `createdAt`. */
export function currentWeight<T extends Pick<WeightEntry, 'measuredAt' | 'createdAt'>>(
  entries: readonly T[],
): T | null {
  let best: T | null = null;
  for (const e of entries) {
    if (
      best === null ||
      e.measuredAt > best.measuredAt ||
      (e.measuredAt === best.measuredAt && e.createdAt > best.createdAt)
    ) {
      best = e;
    }
  }
  return best;
}

/** Local wall-clock hour used when a sheet collects only a past date. */
export const DATE_ONLY_MEASUREMENT_HOUR = 12;

/**
 * `measured_at` for a sheet that only collects a date: now when the date is today, otherwise local noon on that
 * date. The returned instant's local date always equals `date`, so `measured_at` and `local_date` agree.
 */
export function measuredAtForDate(date: LocalDate, now: Date): Date {
  if (toLocalDate(now) === date) return now;
  return localDateTime(date, DATE_ONLY_MEASUREMENT_HOUR);
}

/** `local_date ≤ today` (DATA-13). */
export function isAllowedWeightDate(date: LocalDate, today: LocalDate): boolean {
  return date <= today;
}

/** UX-00 body weight / goal weight range (canonical kg). */
export const WEIGHT_MIN_KG = 20;
export const WEIGHT_MAX_KG = 500;

export function isValidWeightKg(kg: number): boolean {
  return Number.isFinite(kg) && kg >= WEIGHT_MIN_KG && kg <= WEIGHT_MAX_KG;
}

export type WeightHistoryRow<T extends WeightEntry = WeightEntry> = {
  entry: T;
  /** Several entries share this local date, so the row shows the time too (UX-18). */
  showTime: boolean;
  /** Change vs the previous (older) entry in kg, unrounded; `null` for the oldest entry. */
  changeKg: number | null;
};

/** UX-18 Weight History rows from entries sorted newest first (the repository order). */
export function weightHistoryRows<T extends WeightEntry>(newestFirst: readonly T[]): WeightHistoryRow<T>[] {
  const perDate = new Map<string, number>();
  for (const e of newestFirst) perDate.set(e.localDate, (perDate.get(e.localDate) ?? 0) + 1);
  return newestFirst.map((entry, i) => {
    const previous = newestFirst[i + 1];
    return {
      entry,
      showTime: (perDate.get(entry.localDate) ?? 0) > 1,
      changeKg: previous ? entry.weightKg - previous.weightKg : null,
    };
  });
}
