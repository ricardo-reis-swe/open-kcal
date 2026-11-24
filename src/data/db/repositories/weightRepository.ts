// Body weight history (DATA-13). Canonical kg; several measurements per day; physical delete.
import { isValidWeightKg, measuredAtForDate, type WeightEntry } from '@/domain/weight/weight';
import { isLocalDate, nowUtcIso, todayLocal, toLocalDate, type LocalDate } from '@/shared/dates';
import { NotFoundError, ValidationError } from '@/shared/errors';

import type { RepositoryDeps } from './deps';

type WeightRow = { id: string; measured_at: string; local_date: string; weight_kg: number; created_at: string };

const toWeight = (r: WeightRow): WeightEntry => ({
  id: r.id,
  measuredAt: r.measured_at,
  localDate: r.local_date,
  weightKg: r.weight_kg,
  createdAt: r.created_at,
});

// DATA-13: current = latest measured_at, tie-break created_at.
const ORDER = 'ORDER BY measured_at DESC, created_at DESC';

/** Page size for Weight History reads; only bounds the query, users never see it (ARCH-19). */
export const WEIGHT_HISTORY_PAGE = 100;

export type WeightHistoryEntry = WeightEntry & { sameDayCount: number };

export type WeightInput = { localDate: LocalDate; weightKg: number };

export function createWeightRepository({ db, clock, ids }: RepositoryDeps) {
  /** Validates, then derives `measured_at` so it always agrees with `local_date` (≤ today). */
  function prepare(input: WeightInput) {
    const bad: string[] = [];
    if (!isLocalDate(input.localDate) || input.localDate > todayLocal(clock)) bad.push('localDate');
    if (!isValidWeightKg(input.weightKg)) bad.push('weightKg'); // UX-00 20–500 kg
    if (bad.length > 0) throw new ValidationError('Invalid weight entry', bad);
    const measuredAt = measuredAtForDate(input.localDate, clock.now());
    return { measuredAt: measuredAt.toISOString(), localDate: toLocalDate(measuredAt) };
  }

  async function get(id: string): Promise<WeightEntry> {
    const row = await db.getFirst<WeightRow>(
      'SELECT id, measured_at, local_date, weight_kg, created_at FROM weight_entries WHERE id = ?',
      [id],
    );
    if (!row) throw new NotFoundError('Weight entry not found');
    return toWeight(row);
  }

  return {
    get,

    async current(): Promise<WeightEntry | null> {
      const row = await db.getFirst<WeightRow>(
        `SELECT id, measured_at, local_date, weight_kg, created_at FROM weight_entries ${ORDER} LIMIT 1`,
      );
      return row ? toWeight(row) : null;
    },

    /** Newest first (UX-18 Weight History); paged for the virtualized list. */
    async list(limit = 100, offset = 0): Promise<WeightEntry[]> {
      return (
        await db.getAll<WeightRow>(
          `SELECT id, measured_at, local_date, weight_kg, created_at FROM weight_entries ${ORDER} LIMIT ? OFFSET ?`,
          [limit, offset],
        )
      ).map(toWeight);
    },

    /**
     * Newest first, bounded (ARCH-19, UX-18 Weight History). One query with `limit + 1` rows: the extra row is never
     * shown; it gives the oldest shown row its change and tells the caller there is more (`older !== null`).
     * `sameDayCount` is computed in SQL (idx_weight_local_date) so a day split by the limit still shows its time.
     * Grow `limit` for the next page instead of using OFFSET, so writes in between cannot skip or repeat a row.
     */
    async history(limit: number): Promise<{ entries: WeightHistoryEntry[]; older: WeightEntry | null }> {
      if (!Number.isInteger(limit) || limit < 1) throw new ValidationError('Invalid limit', ['limit']);
      const rows = await db.getAll<WeightRow & { same_day: number }>(
        `SELECT id, measured_at, local_date, weight_kg, created_at,
                (SELECT COUNT(*) FROM weight_entries d WHERE d.local_date = w.local_date) AS same_day
         FROM weight_entries w ${ORDER} LIMIT ?`,
        [limit + 1],
      );
      const extra = rows.length > limit ? rows[limit] : undefined;
      return {
        entries: rows.slice(0, limit).map((r) => ({ ...toWeight(r), sameDayCount: r.same_day })),
        older: extra ? toWeight(extra) : null,
      };
    },

    async add(input: WeightInput): Promise<WeightEntry> {
      const { measuredAt, localDate } = prepare(input);
      const now = nowUtcIso(clock);
      const id = ids.newId();
      await db.run(
        'INSERT INTO weight_entries (id, measured_at, local_date, weight_kg, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        [id, measuredAt, localDate, input.weightKg, now, now],
      );
      return get(id);
    },

    /** Keeps the original time when the date is unchanged; otherwise re-derives it (DATA-13). */
    async update(id: string, input: WeightInput): Promise<WeightEntry> {
      const existing = await get(id);
      const derived = prepare(input); // validates either way
      const next =
        existing.localDate === input.localDate
          ? { measuredAt: existing.measuredAt, localDate: input.localDate }
          : derived;
      await db.run(
        'UPDATE weight_entries SET measured_at = ?, local_date = ?, weight_kg = ?, updated_at = ? WHERE id = ?',
        [next.measuredAt, next.localDate, input.weightKg, nowUtcIso(clock), id],
      );
      return get(id);
    },

    async delete(id: string): Promise<void> {
      const { changes } = await db.run('DELETE FROM weight_entries WHERE id = ?', [id]);
      if (changes === 0) throw new NotFoundError('Weight entry not found');
    },
  };
}

export type WeightRepository = ReturnType<typeof createWeightRepository>;
