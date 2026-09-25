// Foods + servings (DATA-11, DATA-15, DATA-16). Custom foods are soft-deleted; external foods are unique by
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

export type CustomFoodInput = FoodInput & {
  nutrients: { energyKcal: number; carbohydrateG: number; proteinG: number; fatG: number };
};

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

function validateFood(input: FoodInput, requireMacros: boolean): void {
  const bad: string[] = [];
  if (input.name.trim().length === 0) bad.push('name');
  if (!(Number.isFinite(input.basisQuantity) && input.basisQuantity > 0)) bad.push('basisQuantity');
  if (input.basisUnit.trim().length === 0) bad.push('basisUnit');
  if (!(Number.isFinite(input.nutrients.energyKcal) && input.nutrients.energyKcal >= 0)) bad.push('energyKcal');
  for (const key of ['carbohydrateG', 'proteinG', 'fatG'] as const) {
    const v = input.nutrients[key];
    if (!isNonNegative(v) || (requireMacros && v === null)) bad.push(key);
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

    /** DATA-16: validate → insert `custom` food → insert ≥1 servings (one default). Does not create an entry. */
    async createCustom(input: CustomFoodInput): Promise<Food> {
      validateFood(input, true);
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

    /** DATA-11: soft delete. Entries keep their snapshots; the food leaves search and recents. */
    async deleteCustom(id: string): Promise<void> {
      const { changes } = await db.run(
        "UPDATE foods SET is_deleted = 1, updated_at = ? WHERE id = ? AND source = 'custom'",
        [nowUtcIso(clock), id],
      );
      if (changes === 0) throw new NotFoundError('Custom food not found');
    },

    /**
     * DATA-15: upsert a remote food + servings + cache metadata before logging, keyed on (source, external_id),
     * so it gets a stable local id and offline reuse. Servings are replaced; entries never reference them.
     */
    async upsertExternal(
      source: ExternalSource,
      externalId: string,
      input: FoodInput,
      cache: CacheMetadata,
    ): Promise<Food> {
      validateFood(input, false);
      if (externalId.trim().length === 0) throw new ValidationError('Missing external id', ['externalId']);
      return db.transaction(async (tx) => {
        const now = nowUtcIso(clock);
        const existing = await tx.getFirst<{ id: string }>(
          'SELECT id FROM foods WHERE source = ? AND external_id = ?',
          [source, externalId],
        );
        const id = existing?.id ?? ids.newId();
        if (existing) {
          await tx.run(
            `UPDATE foods SET name = ?, brand = ?, basis_quantity = ?, basis_unit = ?, energy_kcal = ?, protein_g = ?,
               carbohydrate_g = ?, fat_g = ?, updated_at = ? WHERE id = ?`,
            [...foodValues(input), now, id],
          );
          await tx.run('DELETE FROM food_servings WHERE food_id = ?', [id]);
        } else {
          await tx.run(
            `INSERT INTO foods (id, source, external_id, name, brand, basis_quantity, basis_unit, energy_kcal, protein_g,
               carbohydrate_g, fat_g, is_deleted, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
            [id, source, externalId, ...foodValues(input), now, now],
          );
        }
        await insertServings(tx, ids, id, input.servings);
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
