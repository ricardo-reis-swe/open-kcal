// Foods + servings (DATA-11, DATA-15, DATA-16). Custom and saved external foods are soft-deleted; external foods are unique by
// (source, external_id) and re-fetching updates the existing row instead of duplicating it.
import type { Nutrients } from '@/domain/nutrition/nutrients';
import { nowUtcIso, type UtcIso } from '@/shared/dates';
import { NotFoundError, ValidationError } from '@/shared/errors';

import type { SqlExecutor } from '../sql';
import type { RepositoryDeps } from './deps';

export type FoodSource = 'custom' | 'usda' | 'open_food_facts';
export type ExternalSource = Exclude<FoodSource, 'custom'>;

export type FoodServing = {
  id: string;
  label: string;
  quantity: number;
  unit: string;
  basisMultiplier: number;
  isDefault: boolean;
  sortOrder: number;
};

export type Food = {
  id: string;
  source: FoodSource;
  externalId: string | null;
  name: string;
  brand: string | null;
  basisQuantity: number;
  basisUnit: string;
  nutrients: Nutrients;
  isDeleted: boolean;
  servings: FoodServing[];
};

export type ServingInput = Omit<FoodServing, 'id' | 'sortOrder' | 'isDefault'> & { isDefault?: boolean };

export type FoodInput = {
  name: string;
  brand?: string | null;
  basisQuantity: number;
  basisUnit: string;
  nutrients: Nutrients;
  servings: readonly ServingInput[];
};

export type CustomFoodInput = FoodInput;

export type CacheMetadata = {
  fetchedAt: UtcIso;
  expiresAt: UtcIso;
  rawPayloadJson: string | null;
  schemaVersion: number;
};

type FoodRow = {
  id: string;
  source: FoodSource;
  external_id: string | null;
  name: string;
  brand: string | null;
  basis_quantity: number;
  basis_unit: string;
  energy_kcal: number;
  protein_g: number | null;
  carbohydrate_g: number | null;
  fat_g: number | null;
  is_deleted: number;
};
type ServingRow = {
  id: string;
  label: string;
  quantity: number;
  unit: string;
  basis_multiplier: number;
  is_default: number;
  sort_order: number;
};

const toServing = (r: ServingRow): FoodServing => ({
  id: r.id,
  label: r.label,
  quantity: r.quantity,
  unit: r.unit,
  basisMultiplier: r.basis_multiplier,
  isDefault: r.is_default === 1,
  sortOrder: r.sort_order,
});

const isNonNegative = (v: number | null) => v === null || (Number.isFinite(v) && v >= 0);

function validateFood(input: FoodInput): void {
  const bad: string[] = [];
  if (input.name.trim().length === 0) bad.push('name');
  if (!(Number.isFinite(input.basisQuantity) && input.basisQuantity > 0)) bad.push('basisQuantity');
  if (input.basisUnit.trim().length === 0) bad.push('basisUnit');
  if (!(Number.isFinite(input.nutrients.energyKcal) && input.nutrients.energyKcal >= 0)) bad.push('energyKcal');
  for (const key of ['carbohydrateG', 'proteinG', 'fatG'] as const) {
    const v = input.nutrients[key];
    if (!isNonNegative(v)) bad.push(key);
  }
  // DATA-11: a serving is selectable only with full conversion data.
  if (input.servings.length === 0) bad.push('servings');
  input.servings.forEach((s, i) => {
    if (s.label.trim().length === 0 || s.unit.trim().length === 0) bad.push(`servings.${i}`);
    if (!(s.quantity > 0 && s.basisMultiplier > 0)) bad.push(`servings.${i}`);
  });
  if (input.servings.filter((s) => s.isDefault).length > 1) bad.push('servings.default');
  if (bad.length > 0) throw new ValidationError('Invalid food', [...new Set(bad)]);
}

async function insertServings(
  tx: SqlExecutor,
  ids: RepositoryDeps['ids'],
  foodId: string,
  servings: readonly ServingInput[],
) {
  const defaultIndex = Math.max(
    0,
    servings.findIndex((s) => s.isDefault),
  );
  for (const [i, s] of servings.entries()) {
    await tx.run(
      `INSERT INTO food_servings (id, food_id, label, quantity, unit, basis_multiplier, is_default, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [ids.newId(), foodId, s.label.trim(), s.quantity, s.unit, s.basisMultiplier, i === defaultIndex ? 1 : 0, i],
    );
  }
}

/**
 * PROV-09 refresh: match existing servings by `(label, unit)` case-insensitively, update matches in place (their IDs,
 * and so `recent_foods.last_serving_id`, survive), insert new ones, delete missing ones.
 */
async function mergeServings(
  tx: SqlExecutor,
  ids: RepositoryDeps['ids'],
  foodId: string,
  servings: readonly ServingInput[],
) {
  const existing = await tx.getAll<{ id: string; label: string; unit: string }>(
    'SELECT id, label, unit FROM food_servings WHERE food_id = ?',
    [foodId],
  );
  const key = (label: string, unit: string) => `${label.trim().toLowerCase()}\u0000${unit.trim().toLowerCase()}`;
  const unmatched = new Map(existing.map((e) => [key(e.label, e.unit), e.id]));
  const defaultIndex = Math.max(
    0,
    servings.findIndex((s) => s.isDefault),
  );
  // Clear the flag first: the partial UNIQUE index allows one default per food at any moment.
  await tx.run('UPDATE food_servings SET is_default = 0 WHERE food_id = ?', [foodId]);
  for (const [i, s] of servings.entries()) {
    const k = key(s.label, s.unit);
    const matchId = unmatched.get(k);
    const values = [s.label.trim(), s.quantity, s.unit, s.basisMultiplier, i === defaultIndex ? 1 : 0, i];
    if (matchId) {
      unmatched.delete(k);
      await tx.run(
        `UPDATE food_servings SET label = ?, quantity = ?, unit = ?, basis_multiplier = ?, is_default = ?, sort_order = ?
         WHERE id = ?`,
        [...values, matchId],
      );
    } else {
      await tx.run(
        `INSERT INTO food_servings (id, food_id, label, quantity, unit, basis_multiplier, is_default, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [ids.newId(), foodId, ...values],
      );
    }
  }
  for (const id of unmatched.values()) {
    await tx.run('DELETE FROM food_servings WHERE id = ?', [id]); // recents' last_serving_id → NULL (FK)
  }
}

export async function readFood(db: SqlExecutor, id: string): Promise<Food | null> {
  const row = await db.getFirst<FoodRow>('SELECT * FROM foods WHERE id = ?', [id]);
  if (!row) return null;
  const servings = await db.getAll<ServingRow>(
    'SELECT id, label, quantity, unit, basis_multiplier, is_default, sort_order FROM food_servings WHERE food_id = ? ORDER BY sort_order',
    [id],
  );
  return {
    id: row.id,
    source: row.source,
    externalId: row.external_id,
    name: row.name,
    brand: row.brand,
    basisQuantity: row.basis_quantity,
    basisUnit: row.basis_unit,
    nutrients: {
      energyKcal: row.energy_kcal,
      carbohydrateG: row.carbohydrate_g,
      proteinG: row.protein_g,
      fatG: row.fat_g,
    },
    isDeleted: row.is_deleted === 1,
    servings: servings.map(toServing),
  };
}

const foodValues = (input: FoodInput) => [
  input.name.trim(),
  input.brand?.trim() || null,
  input.basisQuantity,
  input.basisUnit,
  input.nutrients.energyKcal,
  input.nutrients.proteinG,
  input.nutrients.carbohydrateG,
  input.nutrients.fatG,
];

export function createFoodsRepository({ db, clock, ids }: RepositoryDeps) {
  return {
    async get(id: string): Promise<Food> {
      const food = await readFood(db, id);
      if (!food) throw new NotFoundError('Food not found');
      return food;
    },

    /** UX-04 / DATA-15: active custom-food matches for the local `My foods` section. */
    async searchCustom(query: string, limit = 20, offset = 0): Promise<Food[]> {
      const tokens = query.trim().split(/\s+/).filter(Boolean);
      if (tokens.length === 0 || !Number.isInteger(limit) || limit <= 0 || !Number.isInteger(offset) || offset < 0)
        return [];
      const normalized = tokens.join(' ');
      const matches = tokens
        .map(() => "(instr(lower(foods.name), lower(?)) > 0 OR instr(lower(COALESCE(foods.brand, '')), lower(?)) > 0)")
        .join(' AND ');
      const matchArgs = tokens.flatMap((token) => [token, token]);
      // PROV-08: a word start is the beginning of the name or follows whitespace.
      const wordStarts = tokens
        .map(() => '(lower(foods.name) LIKE lower(?) OR lower(foods.name) LIKE lower(?))')
        .join(' AND ');
      const wordArgs = tokens.flatMap((token) => [`${token}%`, `% ${token}%`]);
      const rows = await db.getAll<{ id: string }>(
        `SELECT foods.id FROM foods
         LEFT JOIN recent_foods ON recent_foods.food_id = foods.id
         WHERE foods.source = 'custom' AND foods.is_deleted = 0 AND ${matches}
         ORDER BY CASE
           WHEN lower(foods.name) = lower(?) THEN 0
           WHEN lower(foods.name) LIKE lower(?) THEN 1
           WHEN ${wordStarts} THEN 2
           ELSE 3
         END,
         COALESCE(recent_foods.use_count, 0) DESC, recent_foods.last_used_at DESC,
         length(foods.name), foods.id
         LIMIT ? OFFSET ?`,
        [...matchArgs, normalized, `${normalized}%`, ...wordArgs, limit, offset],
      );
      return Promise.all(rows.map(async ({ id }) => (await readFood(db, id))!));
    },

    /** PROV-08 / DATA-15: cached external foods remain searchable even when their refresh TTL has expired. */
    async searchExternal(query: string, limit = 20, offset = 0): Promise<Food[]> {
      const tokens = query.trim().split(/\s+/).filter(Boolean);
      if (tokens.length === 0 || !Number.isInteger(limit) || limit <= 0 || !Number.isInteger(offset) || offset < 0)
        return [];
      const normalized = tokens.join(' ');
      const matches = tokens
        .map(() => "(instr(lower(foods.name), lower(?)) > 0 OR instr(lower(COALESCE(foods.brand, '')), lower(?)) > 0)")
        .join(' AND ');
      const matchArgs = tokens.flatMap((token) => [token, token]);
      const wordStarts = tokens
        .map(() => '(lower(foods.name) LIKE lower(?) OR lower(foods.name) LIKE lower(?))')
        .join(' AND ');
      const wordArgs = tokens.flatMap((token) => [`${token}%`, `% ${token}%`]);
      const rows = await db.getAll<{ id: string }>(
        `SELECT foods.id FROM foods
         JOIN food_cache_metadata ON food_cache_metadata.food_id = foods.id
         LEFT JOIN recent_foods ON recent_foods.food_id = foods.id
         WHERE foods.source IN ('usda', 'open_food_facts') AND foods.is_deleted = 0 AND ${matches}
         ORDER BY CASE
           WHEN lower(foods.name) = lower(?) THEN 0
           WHEN lower(foods.name) LIKE lower(?) THEN 1
           WHEN ${wordStarts} THEN 2
           ELSE 3
         END,
         COALESCE(recent_foods.use_count, 0) DESC, recent_foods.last_used_at DESC,
         length(foods.name), foods.id LIMIT ? OFFSET ?`,
        [...matchArgs, normalized, `${normalized}%`, ...wordArgs, limit, offset],
      );
      return Promise.all(rows.map(async ({ id }) => (await readFood(db, id))!));
    },

    /** DATA-16: validate → insert `custom` food → insert ≥1 servings (one default). Does not create an entry. */
    async createCustom(input: CustomFoodInput): Promise<Food> {
      validateFood(input);
      return db.transaction(async (tx) => {
        const now = nowUtcIso(clock);
        const id = ids.newId();
        await tx.run(
          `INSERT INTO foods (id, source, external_id, name, brand, basis_quantity, basis_unit, energy_kcal, protein_g,
             carbohydrate_g, fat_g, is_deleted, created_at, updated_at)
           VALUES (?, 'custom', NULL, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
          [id, ...foodValues(input), now, now],
        );
        await insertServings(tx, ids, id, input.servings);
        return (await readFood(tx, id))!;
      });
    },

    /** DATA-11: soft delete of a custom or saved external food. Entries keep their snapshots; it leaves search and recents. */
    async deleteFood(id: string): Promise<void> {
      const { changes } = await db.run('UPDATE foods SET is_deleted = 1, updated_at = ? WHERE id = ?', [
        nowUtcIso(clock),
        id,
      ]);
      if (changes === 0) throw new NotFoundError('Food not found');
    },

    /** DATA-11: Undo reactivates a soft-deleted food without changing its servings or history. */
    async restoreFood(id: string): Promise<void> {
      const { changes } = await db.run(
        'UPDATE foods SET is_deleted = 0, updated_at = ? WHERE id = ? AND is_deleted = 1',
        [nowUtcIso(clock), id],
      );
      if (changes === 0) throw new NotFoundError('Deleted food not found');
    },

    /**
     * DATA-15: upsert a remote food + servings + cache metadata before logging, keyed on (source, external_id),
     * so it gets a stable local id and offline reuse. Servings are merged by `(label, unit)` (PROV-09).
     */
    async upsertExternal(
      source: ExternalSource,
      externalId: string,
      input: FoodInput,
      cache: CacheMetadata,
    ): Promise<Food> {
      validateFood(input);
      if (externalId.trim().length === 0) throw new ValidationError('Missing external id', ['externalId']);
      return db.transaction(async (tx) => {
        const now = nowUtcIso(clock);
        // DATA-11: re-selecting a deleted saved food from its provider saves it again.
        const existing = await tx.getFirst<{ id: string }>(
          'SELECT id FROM foods WHERE source = ? AND external_id = ?',
          [source, externalId],
        );
        const id = existing?.id ?? ids.newId();
        if (existing) {
          await tx.run(
            `UPDATE foods SET name = ?, brand = ?, basis_quantity = ?, basis_unit = ?, energy_kcal = ?, protein_g = ?,
               carbohydrate_g = ?, fat_g = ?, is_deleted = 0, updated_at = ? WHERE id = ?`,
            [...foodValues(input), now, id],
          );
          await mergeServings(tx, ids, id, input.servings);
        } else {
          await tx.run(
            `INSERT INTO foods (id, source, external_id, name, brand, basis_quantity, basis_unit, energy_kcal, protein_g,
               carbohydrate_g, fat_g, is_deleted, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
            [id, source, externalId, ...foodValues(input), now, now],
          );
          await insertServings(tx, ids, id, input.servings);
        }
        await tx.run(
          `INSERT INTO food_cache_metadata (food_id, fetched_at, expires_at, raw_payload_json, schema_version)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT (food_id) DO UPDATE SET fetched_at = excluded.fetched_at, expires_at = excluded.expires_at,
             raw_payload_json = excluded.raw_payload_json, schema_version = excluded.schema_version`,
          [id, cache.fetchedAt, cache.expiresAt, cache.rawPayloadJson, cache.schemaVersion],
        );
        return (await readFood(tx, id))!;
      });
    },

    /** Expiry controls refresh, not validity: expired foods stay loggable offline (DATA-15). */
    async cacheMetadata(foodId: string): Promise<(CacheMetadata & { isExpired: boolean }) | null> {
      const row = await db.getFirst<{
        fetched_at: string;
        expires_at: string;
        raw_payload_json: string | null;
        schema_version: number;
      }>('SELECT fetched_at, expires_at, raw_payload_json, schema_version FROM food_cache_metadata WHERE food_id = ?', [
        foodId,
      ]);
      if (!row) return null;
      return {
        fetchedAt: row.fetched_at,
        expiresAt: row.expires_at,
        rawPayloadJson: row.raw_payload_json,
        schemaVersion: row.schema_version,
        isExpired: row.expires_at <= nowUtcIso(clock),
      };
    },
  };
}

export type FoodsRepository = ReturnType<typeof createFoodsRepository>;
