// USDA normalization (PROV-05/06/07/08/14). Payloads never leave this adapter.
import { z } from 'zod';

import { schemaError } from '@/data/api/diagnostics';
import type { FoodInput, ServingInput } from '@/data/db/repositories/foodsRepository';
import {
  catalogNutrient,
  convertNutrientUnit,
  nutrientGrams,
  type NutrientAmounts,
  type NutrientId,
  type NutrientUnit,
} from '@/domain/nutrition/nutrientCatalog';
import { barcodeFromProvider } from '@/domain/food/barcode';
import { ProviderResponseError } from '@/shared/errors';

/** PROV-09: bump on a mapping change so cached foods refresh on their next open (2: PROV-14 nutrients, 3: DATA-24 barcode). */
export const PARSER_VERSION = 3;

const numberLike = z.union([z.number(), z.string()]).transform((value, ctx) => {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    ctx.addIssue({ code: 'custom', message: 'Expected a finite number' });
    return z.NEVER;
  }
  return parsed;
});

const searchNutrientSchema = z.object({
  nutrientNumber: z.union([z.string(), z.number()]).transform(String),
  unitName: z.string(),
  value: numberLike,
});
const detailNutrientSchema = z.object({
  nutrient: z.object({ number: z.union([z.string(), z.number()]).transform(String), unitName: z.string() }),
  amount: numberLike.optional(),
});
const portionSchema = z.object({
  amount: numberLike.optional(),
  gramWeight: numberLike.optional(),
  modifier: z.string().optional(),
  portionDescription: z.string().optional(),
  measureUnit: z.object({ name: z.string().optional() }).optional(),
});
const baseFoodSchema = z.object({
  fdcId: z.union([z.string(), z.number()]).transform(String),
  description: z.string(),
  dataType: z.string().optional(),
  brandOwner: z.string().optional(),
  brandName: z.string().optional(),
  gtinUpc: z.string().optional(),
  servingSize: numberLike.optional(),
  servingSizeUnit: z.string().optional(),
  householdServingFullText: z.string().optional(),
  labelNutrients: z
    .object({
      calories: z.object({ value: numberLike }).optional(),
      protein: z.object({ value: numberLike }).optional(),
      fat: z.object({ value: numberLike }).optional(),
      carbohydrates: z.object({ value: numberLike }).optional(),
      fiber: z.object({ value: numberLike }).optional(),
      sugars: z.object({ value: numberLike }).optional(),
      addedSugar: z.object({ value: numberLike }).optional(),
      saturatedFat: z.object({ value: numberLike }).optional(),
      transFat: z.object({ value: numberLike }).optional(),
      cholesterol: z.object({ value: numberLike }).optional(),
      sodium: z.object({ value: numberLike }).optional(),
      potassium: z.object({ value: numberLike }).optional(),
      calcium: z.object({ value: numberLike }).optional(),
      iron: z.object({ value: numberLike }).optional(),
    })
    .optional(),
});
const searchFoodSchema = baseFoodSchema.extend({ foodNutrients: z.array(searchNutrientSchema).default([]) });
const detailFoodSchema = baseFoodSchema.extend({
  foodNutrients: z.array(detailNutrientSchema).default([]),
  foodPortions: z.array(portionSchema).default([]),
});

type UsdaFood = z.infer<typeof baseFoodSchema>;
type Nutrient = { number: string; unit: string; value: number };

export type FoodCandidate = { externalId: string; input: FoodInput };
export type FoodSearchPage = { candidates: FoodCandidate[]; page: number; pageCount: number };

const genericTypes = new Set(['Foundation', 'SR Legacy', 'Survey (FNDDS)']);
const massLabels = new Set(['g', 'gram', 'grams', 'oz', 'ounce', 'ounces', 'lb', 'lbs', 'pound', 'pounds', 'kg']);

function sentenceCase(value: string): string {
  const compact = value.trim().replace(/\s+/g, ' ').slice(0, 200);
  const letters = compact.replace(/[^\p{L}]/gu, '');
  return letters.length > 0 && letters === letters.toUpperCase()
    ? `${compact[0]!.toUpperCase()}${compact.slice(1).toLowerCase()}`
    : compact;
}

function valid(value: number | undefined, maximum: number): number | null {
  return value !== undefined && Number.isFinite(value) && value >= 0 && value <= maximum ? value : null;
}

/** PROV-14: USDA numbers per catalog id, first present wins; `IU ÷ 40` is vitamin D's only IU source. */
const USDA_CATALOG: Record<NutrientId, readonly string[]> = {
  fibre: ['291'],
  sugars: ['269', '269.3'],
  added_sugars: ['539'],
  saturated_fat: ['606'],
  monounsaturated_fat: ['645'],
  polyunsaturated_fat: ['646'],
  trans_fat: ['605'],
  cholesterol: ['601'],
  salt: [],
  sodium: ['307'],
  potassium: ['306'],
  calcium: ['301'],
  iron: ['303'],
  magnesium: ['304'],
  phosphorus: ['305'],
  zinc: ['309'],
  vitamin_a: ['320'],
  vitamin_c: ['401'],
  vitamin_d: ['328', '324'],
  vitamin_e: ['323'],
  vitamin_k: ['430'],
  thiamin: ['404'],
  riboflavin: ['405'],
  niacin: ['406'],
  vitamin_b6: ['415'],
  vitamin_b12: ['418'],
  folate: ['435', '417'],
  caffeine: ['262'],
};

/** PROV-14 Branded fallback: `labelNutrients` key and its unit (per serving). */
const USDA_LABEL_CATALOG: Partial<
  Record<NutrientId, { key: keyof NonNullable<UsdaFood['labelNutrients']>; unit: NutrientUnit }>
> = {
  fibre: { key: 'fiber', unit: 'g' },
  sugars: { key: 'sugars', unit: 'g' },
  added_sugars: { key: 'addedSugar', unit: 'g' },
  saturated_fat: { key: 'saturatedFat', unit: 'g' },
  trans_fat: { key: 'transFat', unit: 'g' },
  cholesterol: { key: 'cholesterol', unit: 'mg' },
  sodium: { key: 'sodium', unit: 'mg' },
  potassium: { key: 'potassium', unit: 'mg' },
  calcium: { key: 'calcium', unit: 'mg' },
  iron: { key: 'iron', unit: 'mg' },
};

function massUnit(unit: string): NutrientUnit | null {
  const u = unit.trim().toLowerCase();
  if (u === 'g') return 'g';
  if (u === 'mg') return 'mg';
  if (u === 'µg' || u === 'μg' || u === 'ug' || u === 'mcg') return 'µg';
  return null;
}

/** PROV-14 sanity bound: negative or more than 100 g per 100 g → unknown. */
function catalogAmount(id: NutrientId, amount: number): number | null {
  return Number.isFinite(amount) && amount >= 0 && nutrientGrams(id, amount) <= 100 ? amount : null;
}

function catalogNutrients(food: UsdaFood, values: Nutrient[]): NutrientAmounts {
  const amounts: NutrientAmounts = {};
  for (const [id, numbers] of Object.entries(USDA_CATALOG) as [NutrientId, readonly string[]][]) {
    const target = catalogNutrient(id).unit;
    for (const number of numbers) {
      const value = values.find((v) => v.number === number);
      if (!value) continue;
      const from = massUnit(value.unit);
      const converted =
        from !== null
          ? convertNutrientUnit(value.value, from, target)
          : number === '324' && value.unit.trim().toLowerCase() === 'iu'
            ? value.value / 40
            : null; // any other unit is a mismatch → missing
      const amount = converted === null ? null : catalogAmount(id, converted);
      if (amount !== null) {
        amounts[id] = amount;
        break;
      }
    }
  }
  if (food.dataType === 'Branded' && food.servingSize && food.servingSize > 0) {
    for (const [id, source] of Object.entries(USDA_LABEL_CATALOG) as [
      NutrientId,
      NonNullable<(typeof USDA_LABEL_CATALOG)[NutrientId]>,
    ][]) {
      const value = food.labelNutrients?.[source.key]?.value;
      if (amounts[id] !== undefined || value === undefined) continue;
      const per100 = (value / food.servingSize) * 100;
      const amount = catalogAmount(id, convertNutrientUnit(per100, source.unit, catalogNutrient(id).unit));
      if (amount !== null) amounts[id] = amount;
    }
  }
  return amounts;
}

function nutrients(food: UsdaFood, values: Nutrient[]) {
  const byNumber = (number: string, unit: string) =>
    valid(
      values.find((value) => value.number === number && value.unit.toLowerCase() === unit.toLowerCase())?.value,
      100,
    );
  const energy =
    valid(values.find((value) => value.number === '208' && value.unit.toLowerCase() === 'kcal')?.value, 900) ??
    valid(values.find((value) => value.number === '958' && value.unit.toLowerCase() === 'kcal')?.value, 900) ??
    valid(values.find((value) => value.number === '957' && value.unit.toLowerCase() === 'kcal')?.value, 900) ??
    (() => {
      const kj = valid(
        values.find((value) => value.number === '268' && value.unit.toLowerCase() === 'kj')?.value,
        900 * 4.184,
      );
      return kj === null ? null : kj / 4.184;
    })();
  const protein = byNumber('203', 'g');
  const fat = byNumber('204', 'g');
  const totalCarbs = byNumber('205', 'g');
  const fibre = byNumber('291', 'g');
  const carbohydrate = totalCarbs === null ? byNumber('205.2', 'g') : Math.max(0, totalCarbs - (fibre ?? 0));
  if (food.dataType === 'Branded' && food.servingSize && food.servingSize > 0) {
    const per100 = (value: number | undefined, maximum: number) => {
      const result = value === undefined ? null : (value / food.servingSize!) * 100;
      return result === null ? null : valid(result, maximum);
    };
    const label = food.labelNutrients;
    const labelCarbs = per100(label?.carbohydrates?.value, 100);
    const labelFibre = per100(label?.fiber?.value, 100);
    return {
      energyKcal: energy ?? per100(label?.calories?.value, 900),
      proteinG: protein ?? per100(label?.protein?.value, 100),
      fatG: fat ?? per100(label?.fat?.value, 100),
      carbohydrateG: carbohydrate ?? (labelCarbs === null ? null : Math.max(0, labelCarbs - (labelFibre ?? 0))),
      ...withExtra(catalogNutrients(food, values)),
    };
  }
  return {
    energyKcal: energy,
    proteinG: protein,
    fatG: fat,
    carbohydrateG: carbohydrate,
    ...withExtra(catalogNutrients(food, values)),
  };
}

/** DATA-20: `extra` only when some catalog nutrient is known. */
const withExtra = (extra: NutrientAmounts) => (Object.keys(extra).length > 0 ? { extra } : {});

function basisUnit(food: UsdaFood): 'g' | 'ml' {
  return food.dataType === 'Branded' && /^(ml|MLT)$/i.test(food.servingSizeUnit ?? '') ? 'ml' : 'g';
}

function basisServings(unit: 'g' | 'ml'): ServingInput[] {
  return unit === 'g'
    ? [
        { label: 'g', quantity: 1, unit: 'g', basisMultiplier: 0.01, isDefault: true },
        { label: 'oz', quantity: 1, unit: 'oz', basisMultiplier: 0.028349523125 },
      ]
    : [
        { label: 'ml', quantity: 1, unit: 'ml', basisMultiplier: 0.01, isDefault: true },
        { label: 'fl oz', quantity: 1, unit: 'fl oz', basisMultiplier: 0.0295735295625 },
      ];
}

function usableLabel(value: string | undefined): string | null {
  const label = value?.trim();
  if (!label || /^\d+(?:\.\d+)?$/.test(label) || massLabels.has(label.toLowerCase())) return null;
  if (/^quantity not specified$|^guideline amount/i.test(label)) return null;
  return label;
}

function portions(food: z.infer<typeof detailFoodSchema>, unit: 'g' | 'ml'): ServingInput[] {
  if (food.dataType === 'Branded') {
    if (!(food.servingSize && food.servingSize > 0)) return basisServings(unit);
    const serving: ServingInput = {
      label: 'serving',
      quantity: 1,
      unit: 'serving',
      basisMultiplier: food.servingSize / 100,
      isDefault: true,
    };
    const hint = food.householdServingFullText?.match(/^\s*([\d.]+)\s+(.+?)\s*$/);
    const label = usableLabel(hint?.[2]);
    if (hint && label && Number(hint[1]) > 0) {
      const hinted: ServingInput = {
        label,
        quantity: 1,
        unit: label,
        basisMultiplier: food.servingSize / Number(hint[1]) / 100,
      };
      return [serving, hinted, ...basisServings(unit).map((item) => ({ ...item, isDefault: false }))];
    }
    return [serving, ...basisServings(unit).map((item) => ({ ...item, isDefault: false }))];
  }
  const result: ServingInput[] = [];
  const labels = new Set<string>();
  for (const portion of food.foodPortions) {
    if (result.length === 6 || !(portion.gramWeight && portion.gramWeight > 0)) continue;
    let amount = portion.amount && portion.amount > 0 ? portion.amount : 1;
    let label: string | null = null;
    let quantity = amount;
    const measure = portion.measureUnit?.name;
    if (measure && measure.toLowerCase() !== 'undetermined') {
      label = usableLabel(measure);
      if (label && portion.modifier && !/^\d/.test(portion.modifier.trim()))
        label = `${label}, ${portion.modifier.trim()}`;
    } else if (portion.portionDescription) {
      const match = portion.portionDescription.match(/^\s*([\d.]+)\s+(.+?)\s*$/);
      label = usableLabel(match?.[2]);
      quantity = match ? Number(match[1]) : amount;
      // FNDDS puts its count in `portionDescription`, not `amount` (PROV-06).
      if (match) amount = quantity;
    } else label = usableLabel(portion.modifier);
    if (!label || !(quantity > 0) || labels.has(label.toLowerCase())) continue;
    labels.add(label.toLowerCase());
    result.push({ label, quantity: 1, unit: label, basisMultiplier: portion.gramWeight / amount / 100 });
  }
  const basis = basisServings(unit).map((item) => ({ ...item, isDefault: result.length === 0 && item.label === unit }));
  if (result.length > 0) result[0]!.isDefault = true;
  return [...result, ...basis];
}

function candidate(food: UsdaFood, values: Nutrient[], servings: ServingInput[]): FoodCandidate | null {
  const name = sentenceCase(food.description);
  const nutrition = nutrients(food, values);
  const energyKcal = nutrition.energyKcal;
  if (!food.fdcId || !name || energyKcal === null) return null;
  if (
    nutrition.energyKcal === 0 &&
    nutrition.proteinG === null &&
    nutrition.carbohydrateG === null &&
    nutrition.fatG === null
  )
    return null;
  const macroKcal = 4 * (nutrition.proteinG ?? 0) + 4 * (nutrition.carbohydrateG ?? 0) + 9 * (nutrition.fatG ?? 0);
  if (nutrition.energyKcal === 0 && macroKcal >= 20) return null;
  const unit = basisUnit(food);
  return {
    externalId: food.fdcId,
    input: {
      name,
      brand: sentenceCase(food.brandName ?? food.brandOwner ?? '') || null,
      basisQuantity: 100,
      basisUnit: unit,
      nutrients: { ...nutrition, energyKcal },
      servings,
      barcode: barcodeFromProvider(food.gtinUpc), // DATA-24
    },
  };
}

/** Maps a single search hit; invalid individual hits are silently dropped (PROV-07). */
export function mapUsdaSearchFood(payload: unknown): FoodCandidate | null {
  const parsed = searchFoodSchema.safeParse(payload);
  if (!parsed.success) throw new ProviderResponseError('USDA search schema error');
  return candidate(
    parsed.data,
    parsed.data.foodNutrients.map((n) => ({ number: n.nutrientNumber, unit: n.unitName, value: n.value })),
    basisServings(basisUnit(parsed.data)),
  );
}

export function mapUsdaFood(payload: unknown): FoodCandidate | null {
  const parsed = detailFoodSchema.safeParse(payload);
  if (!parsed.success) throw schemaError('USDA detail schema error', parsed.error);
  return candidate(
    parsed.data,
    parsed.data.foodNutrients.flatMap((n) =>
      n.amount === undefined ? [] : [{ number: n.nutrient.number, unit: n.nutrient.unitName, value: n.amount }],
    ),
    portions(parsed.data, basisUnit(parsed.data)),
  );
}

export function mapUsdaSearch(payload: unknown): FoodSearchPage {
  const parsed = z
    .object({
      foods: z.array(z.unknown()),
      currentPage: z.number().int().positive(),
      totalPages: z.number().int().nonnegative(),
    })
    .safeParse(payload);
  if (!parsed.success) throw schemaError('USDA search schema error', parsed.error);
  const candidates = parsed.data.foods.flatMap((food) => {
    try {
      const result = mapUsdaSearchFood(food);
      return result ? [result] : [];
    } catch (error) {
      if (error instanceof ProviderResponseError) return [];
      throw error;
    }
  });
  return {
    candidates: candidates.sort((a, b) => {
      const dataType = (id: string) =>
        (
          parsed.data.foods.find(
            (food) => typeof food === 'object' && food !== null && String((food as { fdcId?: unknown }).fdcId) === id,
          ) as { dataType?: unknown } | undefined
        )?.dataType;
      return (
        Number(!genericTypes.has(String(dataType(a.externalId)))) -
        Number(!genericTypes.has(String(dataType(b.externalId))))
      );
    }),
    page: parsed.data.currentPage,
    pageCount: parsed.data.totalPages,
  };
}

/**
 * PROV-15: the first Branded hit whose `gtinUpc` is the scanned GTIN-14, as an fdcId. The search is full text, so any
 * other hit is ignored; a hit that doesn't parse is skipped rather than failing the lookup.
 */
export function mapUsdaBarcodeSearch(payload: unknown, gtin14: string): string | null {
  const parsed = z.object({ foods: z.array(z.unknown()) }).safeParse(payload);
  if (!parsed.success) throw schemaError('USDA search schema error', parsed.error);
  for (const food of parsed.data.foods) {
    const hit = z
      .object({ fdcId: z.union([z.string(), z.number()]).transform(String), gtinUpc: z.string().optional() })
      .safeParse(food);
    if (hit.success && barcodeFromProvider(hit.data.gtinUpc) === gtin14) return hit.data.fdcId;
  }
  return null;
}
