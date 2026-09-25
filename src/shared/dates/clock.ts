// Injectable clock (ARCH-04 infrastructure) so "today" and timestamps are deterministic in tests.
import { toLocalDate, toUtcIso, type LocalDate, type UtcIso } from './localDate';

export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

export function todayLocal(clock: Clock): LocalDate {
  return toLocalDate(clock.now());
}

export function nowUtcIso(clock: Clock): UtcIso {
  return toUtcIso(clock.now());
}

export function fixedClock(instant: Date | string): Clock {
  const at = typeof instant === 'string' ? new Date(instant) : instant;
  return { now: () => new Date(at.getTime()) };
}
