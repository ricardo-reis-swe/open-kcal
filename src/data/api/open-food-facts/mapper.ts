// Open Food Facts normalization (PROV-05/06/07). Payloads stay inside the adapter.
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

// Real OFF products mix in non-numeric "_modifier" annotations (e.g. "<", "~") alongside the
// numeric fields on the same nutriments object; drop those instead of failing the whole product.
const nutrimentsSchema = z.record(z.string(), z.union([z.number(), z.string()]).optional()).transform((record) => {
  const result: Record<string, number> = {};
  for (const [key, value] of Object.entries(record)) {
    if (value === undefined) continue;
    const parsed = typeof value === 'number' ? value : Number(value);
    if (Number.isFinite(parsed)) result[key] = parsed;
  }
  return result;
});
const productSchema = z.object({
  code: z.union([z.string(), z.number()]).transform(String),
  product_name: z.string().optional(),
  brands: z.union([z.string(), z.array(z.string())]).optional(),
  nutriments: nutrimentsSchema.default({}),
  serving_quantity: numberLike.optional(),
  serving_size: z.string().optional(),
  quantity: z.string().optional(),
  product_quantity: numberLike.optional(),
  nutrition_data_per: z.string().optional(),
});

export type OpenFoodFactsProduct = z.infer<typeof productSchema>;

export type FoodCandidate = {
  externalId: string;
  input: FoodInput;
};

export type FoodSearchPage = {
  candidates: FoodCandidate[];
  page: number;
  pageCount: number;
};

const finiteNonNegative = (value: number | undefined): number | null =>
  value !== undefined && Number.isFinite(value) && value >= 0 ? value : null;

function sentenceCase(value: string): string {
  const compact = value.trim().replace(/\s+/g, ' ').slice(0, 200);
  if (!compact) return '';
  const letters = compact.replace(/[^\p{L}]/gu, '');
  return letters.length > 0 && letters === letters.toUpperCase()
    ? `${compact[0]!.toUpperCase()}${compact.slice(1).toLowerCase()}`
    : compact;
}

function brand(value: string | string[] | undefined): string | null {
  const first = Array.isArray(value) ? value[0] : value?.split(',')[0];
  const normalized = first ? sentenceCase(first) : '';
  return normalized || null;
}

function nutrient(values: Record<string, number | undefined>, key: string, maximum = 100): number | null {
  const value = finiteNonNegative(values[key]);
  return value === null || value > maximum ? null : value;
}

function isVolume(text: string): boolean {
  return /\b(?:ml|cl|dl|l|fl\.?\s*oz)\b/i.test(text);
}

function isMass(text: string): boolean {
  return /\b(?:g|gr|kg|oz|lb)\b/i.test(text);
}

function basisUnit(product: OpenFoodFactsProduct): 'g' | 'ml' {
  const text = `${product.serving_size ?? ''} ${product.quantity ?? ''}`;
  return isVolume(text) && !isMass(text) ? 'ml' : 'g';
}

function servingFromProduct(
  product: OpenFoodFactsProduct,
  unit: 'g' | 'ml',
): { quantity: number; unit: 'g' | 'ml' } | null {
  const quantity = finiteNonNegative(product.serving_quantity);
  if (quantity === null || quantity <= 0) return null;
  return { quantity, unit };
}

function hintedServing(product: OpenFoodFactsProduct, unit: 'g' | 'ml'): ServingInput | null {
  const match = product.serving_size?.match(/^\s*([\d.,]+)\s+(.+?)\s+\(([\d.,]+)\s*(g|ml)\)\s*$/i);
  if (!match || match[4]!.toLowerCase() !== unit) return null;
  const count = Number(match[1]!.replace(',', '.'));
  const amount = Number(match[3]!.replace(',', '.'));
  const label = match[2]!.trim();
  if (!(count > 0 && amount > 0 && label)) return null;
  return { label, quantity: 1, unit: label, basisMultiplier: amount / count / 100 };
}

/** Returns null for a single unusable hit: dropping it is not a provider-wide error (PROV-07). */
export function mapOpenFoodFactsProduct(payload: unknown): FoodCandidate | null {
  const parsed = productSchema.safeParse(payload);
  if (!parsed.success) throw schemaError('Open Food Facts schema error', parsed.error);
  const product = parsed.data;
  const name = sentenceCase(product.product_name ?? '');
  const externalId = product.code;
  if (!externalId || !name) return null;

  const n = product.nutriments;
  const energy =
    nutrient(n, 'energy-kcal_100g', 900) ??
    (() => {
      const kj = finiteNonNegative(n['energy-kj_100g']) ?? finiteNonNegative(n.energy_100g);
      const converted = kj === null ? null : kj / 4.184;
      return converted === null || converted > 900 ? null : converted;
    })();
  const unit = basisUnit(product);
  const servingQuantity = finiteNonNegative(product.serving_quantity);
  const fromServing = (key: string, maximum = 100) => {
    const value = finiteNonNegative(n[`${key}_serving`]);
    if (value === null || servingQuantity === null || servingQuantity <= 0) return null;
    const per100 = (value / servingQuantity) * 100;
    return per100 > maximum ? null : per100;
  };
  const protein = nutrient(n, 'proteins_100g') ?? fromServing('proteins');
  const carbohydrate = nutrient(n, 'carbohydrates_100g') ?? fromServing('carbohydrates');
  const fat = nutrient(n, 'fat_100g') ?? fromServing('fat');
  const resolvedEnergy =
    energy ??
    (() => {
      const per100 = fromServing('energy-kcal', 900);
      return (
        per100 ??
        (() => {
          const kj = fromServing('energy-kj', 900 * 4.184) ?? fromServing('energy', 900 * 4.184);
          return kj === null ? null : kj / 4.184;
        })()
      );
    })();
  if (resolvedEnergy === null || (resolvedEnergy === 0 && protein === null && carbohydrate === null && fat === null))
    return null;
  const macroKcal = 4 * (protein ?? 0) + 4 * (carbohydrate ?? 0) + 9 * (fat ?? 0);
  if (resolvedEnergy === 0 && macroKcal >= 20) return null;

  const serving = servingFromProduct(product, unit);
  const servings: ServingInput[] = [{ label: unit, quantity: 1, unit, basisMultiplier: 0.01, isDefault: !serving }];
  if (unit === 'g') servings.push({ label: 'oz', quantity: 1, unit: 'oz', basisMultiplier: 0.028349523125 });
  else servings.push({ label: 'fl oz', quantity: 1, unit: 'fl oz', basisMultiplier: 0.0295735295625 });
  if (serving) {
    servings.unshift({
      label: 'serving',
      quantity: 1,
      unit: 'serving',
      basisMultiplier: serving.quantity / 100,
      isDefault: true,
    });
  }
  const hint = hintedServing(product, unit);
  if (hint && !servings.some((candidate) => candidate.label.toLowerCase() === hint.label.toLowerCase()))
    servings.splice(serving ? 1 : 0, 0, hint);
  return {
    externalId,
    input: {
      name,
      brand: brand(product.brands),
      basisQuantity: 100,
      basisUnit: unit,
      nutrients: { energyKcal: resolvedEnergy, carbohydrateG: carbohydrate, proteinG: protein, fatG: fat },
      servings,
    },
  };
}

export function mapOpenFoodFactsSearch(payload: unknown): FoodSearchPage {
  const response = z
    .object({
      hits: z.array(z.unknown()),
      page: z.number().int().positive().default(1),
      page_count: z.number().int().nonnegative().default(0),
    })
    .safeParse(payload);
  if (!response.success) throw schemaError('Open Food Facts search schema error', response.error);
  return {
    candidates: response.data.hits.flatMap((hit) => {
      try {
        const candidate = mapOpenFoodFactsProduct(hit);
        return candidate ? [candidate] : [];
      } catch (error) {
        if (error instanceof ProviderResponseError) return [];
        throw error;
      }
    }),
    page: response.data.page,
    pageCount: response.data.page_count,
  };
}
