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
