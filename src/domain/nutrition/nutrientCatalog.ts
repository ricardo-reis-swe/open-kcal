// DATA-20 nutrient catalog: the source of truth for catalog ids, groups, units, display order and decimals.
// Ids are stored in SQLite (`food_nutrients`, `diary_entry_nutrients`, DATA-21 setting): never rename one.

export type NutrientUnit = 'g' | 'mg' | 'µg';
export type NutrientGroup = 'fatsSugars' | 'minerals' | 'vitamins' | 'other';

export const NUTRIENT_GROUPS: readonly NutrientGroup[] = ['fatsSugars', 'minerals', 'vitamins', 'other'];

export const NUTRIENT_CATALOG = [
  { id: 'fibre', group: 'fatsSugars', unit: 'g', decimals: 1 },
  { id: 'sugars', group: 'fatsSugars', unit: 'g', decimals: 1 },
  { id: 'added_sugars', group: 'fatsSugars', unit: 'g', decimals: 1 },
  { id: 'saturated_fat', group: 'fatsSugars', unit: 'g', decimals: 1 },
  { id: 'monounsaturated_fat', group: 'fatsSugars', unit: 'g', decimals: 1 },
  { id: 'polyunsaturated_fat', group: 'fatsSugars', unit: 'g', decimals: 1 },
  { id: 'trans_fat', group: 'fatsSugars', unit: 'g', decimals: 1 },
  { id: 'cholesterol', group: 'fatsSugars', unit: 'mg', decimals: 0 },
  { id: 'salt', group: 'minerals', unit: 'g', decimals: 2 },
  { id: 'sodium', group: 'minerals', unit: 'mg', decimals: 0 },
  { id: 'potassium', group: 'minerals', unit: 'mg', decimals: 0 },
  { id: 'calcium', group: 'minerals', unit: 'mg', decimals: 0 },
  { id: 'iron', group: 'minerals', unit: 'mg', decimals: 1 },
  { id: 'magnesium', group: 'minerals', unit: 'mg', decimals: 0 },
  { id: 'phosphorus', group: 'minerals', unit: 'mg', decimals: 0 },
  { id: 'zinc', group: 'minerals', unit: 'mg', decimals: 1 },
  { id: 'vitamin_a', group: 'vitamins', unit: 'µg', decimals: 0 },
  { id: 'vitamin_c', group: 'vitamins', unit: 'mg', decimals: 1 },
  { id: 'vitamin_d', group: 'vitamins', unit: 'µg', decimals: 1 },
  { id: 'vitamin_e', group: 'vitamins', unit: 'mg', decimals: 1 },
  { id: 'vitamin_k', group: 'vitamins', unit: 'µg', decimals: 1 },
  { id: 'thiamin', group: 'vitamins', unit: 'mg', decimals: 2 },
  { id: 'riboflavin', group: 'vitamins', unit: 'mg', decimals: 2 },
  { id: 'niacin', group: 'vitamins', unit: 'mg', decimals: 1 },
  { id: 'vitamin_b6', group: 'vitamins', unit: 'mg', decimals: 2 },
  { id: 'vitamin_b12', group: 'vitamins', unit: 'µg', decimals: 2 },
  { id: 'folate', group: 'vitamins', unit: 'µg', decimals: 0 },
  { id: 'caffeine', group: 'other', unit: 'mg', decimals: 0 },
] as const satisfies readonly { id: string; group: NutrientGroup; unit: NutrientUnit; decimals: number }[];

export type NutrientId = (typeof NUTRIENT_CATALOG)[number]['id'];
export type CatalogNutrient = (typeof NUTRIENT_CATALOG)[number];

export const NUTRIENT_IDS: readonly NutrientId[] = NUTRIENT_CATALOG.map((n) => n.id);

const BY_ID = new Map<string, CatalogNutrient>(NUTRIENT_CATALOG.map((n) => [n.id, n]));

/** Catalog nutrient amounts in their catalog unit. A missing key = unknown, `0` = known zero (DATA-06/20). */
export type NutrientAmounts = Partial<Record<NutrientId, number>>;

export function isNutrientId(value: string): value is NutrientId {
  return BY_ID.has(value);
}

export function catalogNutrient(id: NutrientId): CatalogNutrient {
  return BY_ID.get(id)!;
}

const GRAMS_PER_UNIT: Record<NutrientUnit, number> = { g: 1, mg: 1e-3, µg: 1e-6 };

/** Converts between g / mg / µg (DATA-04 keeps full precision; no rounding here). */
export function convertNutrientUnit(value: number, from: NutrientUnit, to: NutrientUnit): number {
  return (value * GRAMS_PER_UNIT[from]) / GRAMS_PER_UNIT[to];
}

/** An amount in grams, for the PROV-14 "> 100 g per 100 g" sanity bound. */
export function nutrientGrams(id: NutrientId, amount: number): number {
  return convertNutrientUnit(amount, catalogNutrient(id).unit, 'g');
}

const isAmount = (value: number | undefined): value is number =>
  value !== undefined && Number.isFinite(value) && value >= 0;

/** DATA-20: salt g = sodium mg × 2.5 ÷ 1000. When a source gives only one, both are stored. */
export function withSaltAndSodium(amounts: NutrientAmounts): NutrientAmounts {
  const { salt, sodium } = amounts;
  if (isAmount(salt) && !isAmount(sodium)) return { ...amounts, sodium: (salt * 1000) / 2.5 };
  if (isAmount(sodium) && !isAmount(salt)) return { ...amounts, salt: (sodium * 2.5) / 1000 };
  return amounts;
}

/** Scales every known amount (entry snapshot, DATA-16); unknowns stay unknown. */
export function scaleNutrientAmounts(amounts: NutrientAmounts, factor: number): NutrientAmounts {
  const scaled: NutrientAmounts = {};
  for (const [id, value] of Object.entries(amounts) as [NutrientId, number][]) scaled[id] = value * factor;
  return scaled;
}

/** Known amounts in catalog order, for storage and display. */
export function knownNutrients(amounts: NutrientAmounts | undefined): { id: NutrientId; amount: number }[] {
  if (!amounts) return [];
  return NUTRIENT_IDS.filter((id) => isAmount(amounts[id])).map((id) => ({ id, amount: amounts[id]! }));
}

/** Rows read from SQLite → amounts; ids outside the catalog are ignored (DATA-20). */
export function nutrientAmountsFromRows(rows: readonly { nutrient_id: string; amount: number }[]): NutrientAmounts {
  const amounts: NutrientAmounts = {};
  for (const row of rows) if (isNutrientId(row.nutrient_id)) amounts[row.nutrient_id] = row.amount;
  return amounts;
}
