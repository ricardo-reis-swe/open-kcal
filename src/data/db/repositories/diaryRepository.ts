// Diary entries and the derived diary day (DATA-05/06/07/12/14/16). Totals always come from entry snapshots, never
// from `foods`, and are aggregated in SQL as known sum + unknown count per macro (ARCH-19).
import { normalizeNote, isValidQuickCaloriesKcal, type EntryKind } from '@/domain/diary/entries';
import type { NutritionGoal } from '@/domain/nutrition/goals';
import {
  EMPTY_TOTALS,
  combineTotals,
  servingNutrients,
  type Nutrients,
  type NutrientTotals,
} from '@/domain/nutrition/nutrients';
import { isLocalDate, nowUtcIso, type LocalDate } from '@/shared/dates';
import { NotFoundError, ValidationError } from '@/shared/errors';

import type { SqlExecutor } from '../sql';
import type { RepositoryDeps } from './deps';
import { readFood } from './foodsRepository';
import { readGoalFor } from './goalsRepository';
import type { Meal } from './mealsRepository';

/** Display name snapshot for Quick Calories entries (DATA-06); the UI localizes the label from `kind`. */
export const QUICK_CALORIES_NAME = 'Quick Calories';

export type DiaryEntry = {
  id: string;
  kind: EntryKind;
  diaryDate: LocalDate;
  mealId: string;
  foodId: string | null;
  name: string;
  brand: string | null;
  servingQuantity: number | null;
  servingUnit: string | null;
  nutrients: Nutrients;
  note: string | null;
  sortOrder: number;
};

export type DiaryMeal = { meal: Meal; entries: DiaryEntry[]; totals: NutrientTotals };
export type DiaryDay = { date: LocalDate; goal: NutritionGoal | null; meals: DiaryMeal[]; totals: NutrientTotals };

type EntryRow = {
  id: string;
  entry_kind: EntryKind;
  diary_date: string;
  meal_id: string;
  food_id: string | null;
  food_name_snapshot: string;
  brand_snapshot: string | null;
  serving_quantity: number | null;
  serving_unit_snapshot: string | null;
  energy_kcal: number;
  protein_g: number | null;
  carbohydrate_g: number | null;
  fat_g: number | null;
  note: string | null;
  sort_order: number;
};

type TotalsRow = {
  meal_id: string;
  entry_count: number;
  energy_kcal: number;
  known_carbohydrate_g: number | null;
  unknown_carbohydrate_count: number;
  known_protein_g: number | null;
  unknown_protein_count: number;
  known_fat_g: number | null;
  unknown_fat_count: number;
};

const toEntry = (r: EntryRow): DiaryEntry => ({
  id: r.id,
  kind: r.entry_kind,
  diaryDate: r.diary_date,
  mealId: r.meal_id,
  foodId: r.food_id,
  name: r.food_name_snapshot,
  brand: r.brand_snapshot,
  servingQuantity: r.serving_quantity,
  servingUnit: r.serving_unit_snapshot,
  nutrients: { energyKcal: r.energy_kcal, carbohydrateG: r.carbohydrate_g, proteinG: r.protein_g, fatG: r.fat_g },
  note: r.note,
  sortOrder: r.sort_order,
});

// DATA-06: SUM ignores NULLs; unknowns are counted separately so they never become 0.
const TOTALS_SQL = `
  SELECT meal_id, COUNT(*) AS entry_count, SUM(energy_kcal) AS energy_kcal,
         SUM(carbohydrate_g) AS known_carbohydrate_g,
         SUM(CASE WHEN carbohydrate_g IS NULL THEN 1 ELSE 0 END) AS unknown_carbohydrate_count,
         SUM(protein_g) AS known_protein_g,
         SUM(CASE WHEN protein_g IS NULL THEN 1 ELSE 0 END) AS unknown_protein_count,
         SUM(fat_g) AS known_fat_g,
         SUM(CASE WHEN fat_g IS NULL THEN 1 ELSE 0 END) AS unknown_fat_count
  FROM diary_entries WHERE diary_date = ? GROUP BY meal_id`;

const toTotals = (r: TotalsRow): NutrientTotals => ({
  energyKcal: r.energy_kcal,
  entryCount: r.entry_count,
  carbohydrateG: { knownSum: r.known_carbohydrate_g ?? 0, unknownCount: r.unknown_carbohydrate_count },
  proteinG: { knownSum: r.known_protein_g ?? 0, unknownCount: r.unknown_protein_count },
  fatG: { knownSum: r.known_fat_g ?? 0, unknownCount: r.unknown_fat_count },
});

function assertDate(date: LocalDate): void {
  if (!isLocalDate(date)) throw new ValidationError('Invalid diary date', ['diaryDate']);
}

async function assertMeal(tx: SqlExecutor, mealId: string): Promise<void> {
  if (!(await tx.getFirst('SELECT 1 AS ok FROM meals WHERE id = ?', [mealId]))) {
    throw new NotFoundError('Meal not found');
  }
}

async function nextSortOrder(tx: SqlExecutor, date: LocalDate, mealId: string): Promise<number> {
  const row = await tx.getFirst<{ next: number }>(
    'SELECT COALESCE(MAX(sort_order) + 1, 0) AS next FROM diary_entries WHERE diary_date = ? AND meal_id = ?',
    [date, mealId],
  );
  return row?.next ?? 0;
}

async function readEntry(db: SqlExecutor, id: string): Promise<DiaryEntry> {
  const row = await db.getFirst<EntryRow>('SELECT * FROM diary_entries WHERE id = ?', [id]);
  if (!row) throw new NotFoundError('Entry not found');
  return toEntry(row);
}

/** Resolves a food serving and computes the unrounded snapshot (DATA-04/05, DATA-11). */
async function snapshotFor(tx: SqlExecutor, foodId: string, servingId: string, quantity: number) {
  if (!(Number.isFinite(quantity) && quantity > 0)) throw new ValidationError('Invalid quantity', ['servingQuantity']);
  const food = await readFood(tx, foodId);
  if (!food || food.isDeleted) throw new NotFoundError('Food not found');
  const serving = food.servings.find((s) => s.id === servingId);
  if (!serving) throw new ValidationError('Serving does not belong to this food', ['servingId']);
  return { food, serving, nutrients: servingNutrients(food.nutrients, serving, quantity) };
}

/** Serving identity for edits: entries keep the serving label snapshot, not its id. */
function sameServingLabel(label: string, snapshotLabel: string | null): boolean {
  return snapshotLabel !== null && label.trim().toLowerCase() === snapshotLabel.trim().toLowerCase();
}

/** DATA-14: recents are upserted only after a successful food entry save (add or edit). */
async function upsertRecent(
  tx: SqlExecutor,
  r: { foodId: string; servingId: string | null; quantity: number; mealId: string; at: string },
): Promise<void> {
  await tx.run(
    `INSERT INTO recent_foods (food_id, last_used_at, use_count, last_serving_id, last_serving_quantity, last_meal_id)
     VALUES (?, ?, 1, ?, ?, ?)
     ON CONFLICT (food_id) DO UPDATE SET last_used_at = excluded.last_used_at, use_count = use_count + 1,
       last_serving_id = excluded.last_serving_id, last_serving_quantity = excluded.last_serving_quantity,
       last_meal_id = excluded.last_meal_id`,
    [r.foodId, r.at, r.servingId, r.quantity, r.mealId],
  );
}

export type AddFoodEntryInput = {
  diaryDate: LocalDate;
  mealId: string;
  foodId: string;
  servingId: string;
  quantity: number;
};
/** The serving currently chosen in the editor (optional); the repository decides whether it changed. */
export type EditFoodEntryInput = { mealId: string; quantity: number; servingId?: string };
export type QuickCaloriesInput = { diaryDate: LocalDate; mealId: string; energyKcal: number; note?: string | null };
export type CopyMealInput = { mealId: string; sourceDate: LocalDate; destinationDate: LocalDate };

export function createDiaryRepository({ db, clock, ids }: RepositoryDeps) {
  return {
    getEntry: (id: string) => readEntry(db, id),

    /** DATA-16 Load day: effective goal → all meals by sort_order (even empty) → entries → totals. */
    async loadDay(date: LocalDate): Promise<DiaryDay> {
      assertDate(date);
      // One read transaction, so entries and SQL totals always describe the same state (DATA-16, ARCH-19).
      return db.transaction(async (tx) => {
        const goal = await readGoalFor(tx, date);
        const meals = (
          await tx.getAll<{ id: string; name: string; sort_order: number }>(
            'SELECT id, name, sort_order FROM meals ORDER BY sort_order',
          )
        ).map((m) => ({ id: m.id, name: m.name, sortOrder: m.sort_order }));
        const rows = await tx.getAll<EntryRow>(
          'SELECT * FROM diary_entries WHERE diary_date = ? ORDER BY meal_id, sort_order, created_at',
          [date],
        );
        const totals = new Map((await tx.getAll<TotalsRow>(TOTALS_SQL, [date])).map((t) => [t.meal_id, toTotals(t)]));
        const dayMeals = meals.map((meal) => ({
          meal,
          entries: rows.filter((r) => r.meal_id === meal.id).map(toEntry),
          totals: totals.get(meal.id) ?? EMPTY_TOTALS,
        }));
        return { date, goal, meals: dayMeals, totals: combineTotals(dayMeals.map((m) => m.totals)) };
      });
    },

    /** DATA-16 Add food entry, one transaction: validate → compute → insert snapshot → upsert recent. */
    async addFoodEntry(input: AddFoodEntryInput): Promise<DiaryEntry> {
      assertDate(input.diaryDate);
      return db.transaction(async (tx) => {
        await assertMeal(tx, input.mealId);
        const { food, serving, nutrients } = await snapshotFor(tx, input.foodId, input.servingId, input.quantity);
        const now = nowUtcIso(clock);
        const id = ids.newId();
        await tx.run(
          `INSERT INTO diary_entries (id, entry_kind, diary_date, meal_id, food_id, food_name_snapshot, brand_snapshot,
             serving_quantity, serving_unit_snapshot, energy_kcal, protein_g, carbohydrate_g, fat_g, note, sort_order,
             created_at, updated_at)
           VALUES (?, 'food', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)`,
          [
            id,
            input.diaryDate,
            input.mealId,
            food.id,
            food.name,
            food.brand,
            input.quantity,
            serving.label,
            nutrients.energyKcal,
            nutrients.proteinG,
            nutrients.carbohydrateG,
            nutrients.fatG,
            await nextSortOrder(tx, input.diaryDate, input.mealId),
            now,
            now,
          ],
        );
        await upsertRecent(tx, {
          foodId: food.id,
          servingId: serving.id,
          quantity: input.quantity,
          mealId: input.mealId,
          at: now,
        });
        return readEntry(tx, id);
      });
    },

    /**
     * DATA-16 Edit food entry. The snapshot is recomputed from the food only when the serving really changed; the
     * repository decides that by comparing the chosen serving's label with the snapshot's, so passing the current
     * serving after a cache refresh never rewrites history (DATA-05). A quantity-only change scales the snapshot
     * (nutrition is linear in quantity), which also works after the food is gone. Moving to another meal changes only
     * `meal_id` + `updated_at` (DATA-12).
     */
    async editFoodEntry(id: string, input: EditFoodEntryInput): Promise<DiaryEntry> {
      if (!(Number.isFinite(input.quantity) && input.quantity > 0)) {
        throw new ValidationError('Invalid quantity', ['servingQuantity']);
      }
      return db.transaction(async (tx) => {
        const entry = await readEntry(tx, id);
        if (entry.kind !== 'food') throw new ValidationError('Not a food entry', ['entryKind']);
        await assertMeal(tx, input.mealId);
        const now = nowUtcIso(clock);
        let chosen: Awaited<ReturnType<typeof snapshotFor>> | null = null;
        if (input.servingId !== undefined) {
          if (entry.foodId === null) throw new NotFoundError('Food not found');
          chosen = await snapshotFor(tx, entry.foodId, input.servingId, input.quantity);
        }
        const servingChanged = chosen !== null && !sameServingLabel(chosen.serving.label, entry.servingUnit);
        let snapshot: { nutrients: Nutrients; unit: string } | null = null;
        if (servingChanged) {
          snapshot = { nutrients: chosen!.nutrients, unit: chosen!.serving.label };
        } else if (input.quantity !== entry.servingQuantity) {
          const factor = input.quantity / entry.servingQuantity!;
          const scale = (v: number | null) => (v === null ? null : v * factor);
          snapshot = {
            nutrients: {
              energyKcal: entry.nutrients.energyKcal * factor,
              carbohydrateG: scale(entry.nutrients.carbohydrateG),
              proteinG: scale(entry.nutrients.proteinG),
              fatG: scale(entry.nutrients.fatG),
            },
            unit: entry.servingUnit!,
          };
        }
        if (snapshot) {
          await tx.run(
            `UPDATE diary_entries SET meal_id = ?, serving_quantity = ?, serving_unit_snapshot = ?, energy_kcal = ?,
               protein_g = ?, carbohydrate_g = ?, fat_g = ?, updated_at = ? WHERE id = ?`,
            [
              input.mealId,
              input.quantity,
              snapshot.unit,
              snapshot.nutrients.energyKcal,
              snapshot.nutrients.proteinG,
              snapshot.nutrients.carbohydrateG,
              snapshot.nutrients.fatG,
              now,
              id,
            ],
          );
        } else if (input.mealId !== entry.mealId) {
          await tx.run('UPDATE diary_entries SET meal_id = ?, updated_at = ? WHERE id = ?', [input.mealId, now, id]);
        }
        if (entry.foodId !== null) {
          const food = await readFood(tx, entry.foodId);
          if (food && !food.isDeleted) {
            const servingId =
              chosen?.serving.id ?? food.servings.find((s) => sameServingLabel(s.label, entry.servingUnit))?.id ?? null;
            await upsertRecent(tx, {
              foodId: food.id,
              servingId,
              quantity: input.quantity,
              mealId: input.mealId,
              at: now,
            });
          }
        }
        return readEntry(tx, id);
      });
    },

    /** DATA-06 / DATA-16: kcal ≥ 0, macros + serving NULL, note trimmed (empty → NULL). Never touches recents. */
    async addQuickCalories(input: QuickCaloriesInput): Promise<DiaryEntry> {
      assertDate(input.diaryDate);
      if (!isValidQuickCaloriesKcal(input.energyKcal)) throw new ValidationError('Invalid kcal', ['energyKcal']);
      return db.transaction(async (tx) => {
        await assertMeal(tx, input.mealId);
        const now = nowUtcIso(clock);
        const id = ids.newId();
        await tx.run(
          `INSERT INTO diary_entries (id, entry_kind, diary_date, meal_id, food_id, food_name_snapshot, energy_kcal, note,
             sort_order, created_at, updated_at)
           VALUES (?, 'quick_calories', ?, ?, NULL, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            input.diaryDate,
            input.mealId,
            QUICK_CALORIES_NAME,
            input.energyKcal,
            normalizeNote(input.note),
            await nextSortOrder(tx, input.diaryDate, input.mealId),
            now,
            now,
          ],
        );
        return readEntry(tx, id);
      });
    },

    async editQuickCalories(id: string, input: Omit<QuickCaloriesInput, 'diaryDate'>): Promise<DiaryEntry> {
      if (!isValidQuickCaloriesKcal(input.energyKcal)) throw new ValidationError('Invalid kcal', ['energyKcal']);
      return db.transaction(async (tx) => {
        const entry = await readEntry(tx, id);
        if (entry.kind !== 'quick_calories') throw new ValidationError('Not a Quick Calories entry', ['entryKind']);
        await assertMeal(tx, input.mealId);
        // DATA-12: a move changes meal_id (+ the edited fields and updated_at), never sort_order.
        await tx.run('UPDATE diary_entries SET meal_id = ?, energy_kcal = ?, note = ?, updated_at = ? WHERE id = ?', [
          input.mealId,
          input.energyKcal,
          normalizeNote(input.note),
          nowUtcIso(clock),
          id,
        ]);
        return readEntry(tx, id);
      });
    },

    /**
     * DATA-16 Copy meal, one transaction: source entries in order → new IDs → snapshots copied exactly (incl. food_id
     * and note) → same `meal_id` on the destination date, appended after its existing entries. The source date may
     * equal the destination (UX-12 appends duplicates). Recents are not touched. Returns the number of copied entries.
     */
    async copyMeal(input: CopyMealInput): Promise<{ copiedCount: number }> {
      assertDate(input.sourceDate);
      assertDate(input.destinationDate);
      return db.transaction(async (tx) => {
        await assertMeal(tx, input.mealId);
        const rows = await tx.getAll<EntryRow>(
          'SELECT * FROM diary_entries WHERE diary_date = ? AND meal_id = ? ORDER BY sort_order, created_at',
          [input.sourceDate, input.mealId],
        );
        const base = await nextSortOrder(tx, input.destinationDate, input.mealId);
        const now = nowUtcIso(clock);
        for (const [i, r] of rows.entries()) {
          await tx.run(
            `INSERT INTO diary_entries (id, entry_kind, diary_date, meal_id, food_id, food_name_snapshot, brand_snapshot,
               serving_quantity, serving_unit_snapshot, energy_kcal, protein_g, carbohydrate_g, fat_g, note, sort_order,
               created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              ids.newId(),
              r.entry_kind,
              input.destinationDate,
              input.mealId,
              r.food_id,
              r.food_name_snapshot,
              r.brand_snapshot,
              r.serving_quantity,
              r.serving_unit_snapshot,
              r.energy_kcal,
              r.protein_g,
              r.carbohydrate_g,
              r.fat_g,
              r.note,
              base + i,
              now,
              now,
            ],
          );
        }
        return { copiedCount: rows.length };
      });
    },

    /** DATA-12: physical delete; totals are derived and recents' use_count is not decremented. */
    async deleteEntry(id: string): Promise<void> {
      const { changes } = await db.run('DELETE FROM diary_entries WHERE id = ?', [id]);
      if (changes === 0) throw new NotFoundError('Entry not found');
    },
  };
}

export type DiaryRepository = ReturnType<typeof createDiaryRepository>;

export type RecentFood = {
  foodId: string;
  lastUsedAt: string;
  useCount: number;
  lastServingId: string | null;
  lastServingQuantity: number | null;
  lastMealId: string | null;
};

/** DATA-14: newest first; soft-deleted foods drop out (DATA-11). */
export function createRecentsRepository({ db }: Pick<RepositoryDeps, 'db'>) {
  return {
    async list(limit = 20): Promise<RecentFood[]> {
      const rows = await db.getAll<{
        food_id: string;
        last_used_at: string;
        use_count: number;
        last_serving_id: string | null;
        last_serving_quantity: number | null;
        last_meal_id: string | null;
      }>(
        `SELECT r.* FROM recent_foods r JOIN foods f ON f.id = r.food_id
         WHERE f.is_deleted = 0 ORDER BY r.last_used_at DESC LIMIT ?`,
        [limit],
      );
      return rows.map((r) => ({
        foodId: r.food_id,
        lastUsedAt: r.last_used_at,
        useCount: r.use_count,
        lastServingId: r.last_serving_id,
        lastServingQuantity: r.last_serving_quantity,
        lastMealId: r.last_meal_id,
      }));
    },
  };
}
