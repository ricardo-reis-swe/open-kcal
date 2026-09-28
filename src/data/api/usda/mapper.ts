// USDA normalization (PROV-05/06/07/08). Payloads never leave this adapter.
import { z } from 'zod';

import { schemaError } from '@/data/api/diagnostics';
import type { FoodInput, ServingInput } from '@/data/db/repositories/foodsRepository';
import { ProviderResponseError } from '@/shared/errors';

export const PARSER_VERSION = 1;

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
  gtinUpc: z.union([z.string(), z.number()]).transform(String).optional(),
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

/** `barcode` = Branded `gtinUpc`, used only for the PROV-08 cross-provider dedupe. */
export type FoodCandidate = { externalId: string; input: FoodInput; barcode?: string };
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
    };
  }
  return { energyKcal: energy, proteinG: protein, fatG: fat, carbohydrateG: carbohydrate };
}

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
    ...(food.dataType === 'Branded' && food.gtinUpc ? { barcode: food.gtinUpc } : {}),
    input: {
      name,
      brand: sentenceCase(food.brandName ?? food.brandOwner ?? '') || null,
      basisQuantity: 100,
      basisUnit: unit,
      nutrients: { ...nutrition, energyKcal },
      servings,
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
