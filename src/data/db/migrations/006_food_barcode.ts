// Migration 6 (DATA-24): `foods.barcode` (GTIN-14) + its index. Saved OFF foods are backfilled from their code by
// zero-padding (no check-digit test in SQL); USDA foods get theirs on their next PROV-09 refresh. `schema/schema.sql`
// carries the same shape. Forward-only: never edit a shipped migration, add a new one.
import type { Migration } from './types';

export const migration006: Migration = {
  version: 6,
  name: 'food barcode',
  up: (tx) =>
    tx.exec(`
      ALTER TABLE foods ADD COLUMN barcode TEXT CHECK (barcode IS NULL OR (length(barcode) = 14 AND barcode NOT GLOB '*[^0-9]*'));
      CREATE INDEX idx_foods_barcode ON foods (barcode) WHERE barcode IS NOT NULL;
      UPDATE foods SET barcode = substr('00000000000000' || external_id, -14, 14)
        WHERE source = 'open_food_facts' AND length(external_id) IN (8, 12, 13, 14) AND external_id NOT GLOB '*[^0-9]*';
    `),
};
