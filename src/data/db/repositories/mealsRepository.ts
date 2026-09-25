// Meals (DATA-10). Ordinary records; names may repeat; at least one meal always exists.
import { nowUtcIso } from '@/shared/dates';
import { ConflictError, NotFoundError, ValidationError } from '@/shared/errors';

import type { SqlExecutor } from '../sql';
import type { RepositoryDeps } from './deps';

export type Meal = { id: string; name: string; sortOrder: number };

type MealRow = { id: string; name: string; sort_order: number };
const toMeal = (r: MealRow): Meal => ({ id: r.id, name: r.name, sortOrder: r.sort_order });

function validName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) throw new ValidationError('Meal name is required', ['name']);
  return trimmed;
}

async function listMeals(db: SqlExecutor): Promise<Meal[]> {
  return (await db.getAll<MealRow>('SELECT id, name, sort_order FROM meals ORDER BY sort_order')).map(toMeal);
}

/**
 * Writes `orderedIds` as sort_order 0..n-1. SQLite can't defer UNIQUE, so rows first move to temporary values above
 * every current one, then to their final positions (DATA-10 two-phase update).
 */
async function writeOrder(tx: SqlExecutor, orderedIds: readonly string[], now: string): Promise<void> {
  const top = await tx.getFirst<{ max: number | null }>('SELECT MAX(sort_order) AS max FROM meals');
  const offset = (top?.max ?? 0) + 1;
  for (const [i, id] of orderedIds.entries()) {
    await tx.run('UPDATE meals SET sort_order = ? WHERE id = ?', [offset + i, id]);
  }
  for (const [i, id] of orderedIds.entries()) {
    await tx.run('UPDATE meals SET sort_order = ?, updated_at = ? WHERE id = ?', [i, now, id]);
  }
}

export function createMealsRepository({ db, clock, ids }: RepositoryDeps) {
  return {
    list: () => listMeals(db),

    async get(id: string): Promise<Meal> {
      const row = await db.getFirst<MealRow>('SELECT id, name, sort_order FROM meals WHERE id = ?', [id]);
      if (!row) throw new NotFoundError('Meal not found');
      return toMeal(row);
    },

    /** New meals append at the end (UX-17). */
    async create(name: string): Promise<Meal> {
      const clean = validName(name);
      return db.transaction(async (tx) => {
        const now = nowUtcIso(clock);
        const top = await tx.getFirst<{ next: number }>('SELECT COALESCE(MAX(sort_order) + 1, 0) AS next FROM meals');
        const id = ids.newId();
        await tx.run('INSERT INTO meals (id, name, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', [
          id,
          clean,
          top?.next ?? 0,
          now,
          now,
        ]);
        return { id, name: clean, sortOrder: top?.next ?? 0 };
      });
    },

    async rename(id: string, name: string): Promise<Meal> {
      const clean = validName(name);
      const { changes } = await db.run('UPDATE meals SET name = ?, updated_at = ? WHERE id = ?', [
        clean,
        nowUtcIso(clock),
        id,
      ]);
      if (changes === 0) throw new NotFoundError('Meal not found');
      return this.get(id);
    },

    /** One transaction; every meal ID must appear exactly once (DATA-10). */
    async reorder(orderedIds: readonly string[]): Promise<Meal[]> {
      return db.transaction(async (tx) => {
        const current = await listMeals(tx);
        const unique = new Set(orderedIds);
        if (
          unique.size !== orderedIds.length ||
          unique.size !== current.length ||
          !current.every((m) => unique.has(m.id))
        ) {
          throw new ValidationError('Reorder must list every meal exactly once', ['orderedIds']);
        }
        await writeOrder(tx, orderedIds, nowUtcIso(clock));
        return listMeals(tx);
      });
    },

    async countEntries(id: string): Promise<number> {
      const row = await db.getFirst<{ c: number }>('SELECT COUNT(*) AS c FROM diary_entries WHERE meal_id = ?', [id]);
      return row?.c ?? 0;
    },

    /**
     * DATA-10 delete, one transaction with full rollback: reassign entries to `targetMealId` → repoint recents →
     * delete → compact sort_order. The last meal can't be deleted; a meal with entries needs a different target.
     */
    async delete(id: string, targetMealId: string | null): Promise<void> {
      await db.transaction(async (tx) => {
        const meals = await listMeals(tx);
        if (!meals.some((m) => m.id === id)) throw new NotFoundError('Meal not found');
        if (meals.length <= 1) throw new ConflictError('At least one meal is required');
        const entries = await tx.getFirst<{ c: number }>('SELECT COUNT(*) AS c FROM diary_entries WHERE meal_id = ?', [
          id,
        ]);
        const now = nowUtcIso(clock);
        if ((entries?.c ?? 0) > 0 || targetMealId !== null) {
          if (targetMealId === null || targetMealId === id || !meals.some((m) => m.id === targetMealId)) {
            throw new ValidationError('Pick a different meal for the entries', ['targetMealId']);
          }
          // Per date, append the moved entries after the target meal's entries, keeping their relative order.
          const moved = await tx.getAll<{ id: string; diary_date: string }>(
            'SELECT id, diary_date FROM diary_entries WHERE meal_id = ? ORDER BY diary_date, sort_order, created_at',
            [id],
          );
          const next = new Map<string, number>();
          for (const entry of moved) {
            let sortOrder = next.get(entry.diary_date);
            if (sortOrder === undefined) {
              const top = await tx.getFirst<{ next: number }>(
                'SELECT COALESCE(MAX(sort_order) + 1, 0) AS next FROM diary_entries WHERE meal_id = ? AND diary_date = ?',
                [targetMealId, entry.diary_date],
              );
              sortOrder = top?.next ?? 0;
            }
            next.set(entry.diary_date, sortOrder + 1);
            await tx.run('UPDATE diary_entries SET meal_id = ?, sort_order = ?, updated_at = ? WHERE id = ?', [
              targetMealId,
              sortOrder,
              now,
              entry.id,
            ]);
          }
          await tx.run('UPDATE recent_foods SET last_meal_id = ? WHERE last_meal_id = ?', [targetMealId, id]);
        }
        await tx.run('DELETE FROM meals WHERE id = ?', [id]);
        await writeOrder(
          tx,
          meals.filter((m) => m.id !== id).map((m) => m.id),
          now,
        );
      });
    },
  };
}

export type MealsRepository = ReturnType<typeof createMealsRepository>;
