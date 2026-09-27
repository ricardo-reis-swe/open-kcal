// Open Food Facts normalization (PROV-05/06/07). Payloads stay inside the adapter.
import { z } from 'zod';

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

const nutrimentsSchema = z.record(z.string(), numberLike.optional());
const productSchema = z.object({
  code: z.union([z.string(), z.number()]).transform(String),
  product_name: z.string().optional(),
  brands: z.union([z.string(), z.array(z.string())]).optional(),
  nutriments: nutrimentsSchema.default({}),
  serving_quantity: numberLike.optional(),
  serving_size: z.string().optional(),
  nutrition_data_per: z.string().optional(),
});

export type OpenFoodFactsProduct = z.infer<typeof productSchema>;

export type FoodCandidate = {
  externalId: string;
  input: FoodInput;
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

function nutrient(values: Record<string, number | undefined>, key: string): number | null {
  return finiteNonNegative(values[key]);
}

function servingFromProduct(product: OpenFoodFactsProduct): { quantity: number; unit: 'g' | 'ml' } | null {
  const quantity = finiteNonNegative(product.serving_quantity);
  if (quantity === null || quantity <= 0) return null;
  const text = product.serving_size?.toLowerCase() ?? '';
  return { quantity, unit: /\bml\b/.test(text) ? 'ml' : 'g' };
}

/** Returns null for a single unusable hit: dropping it is not a provider-wide error (PROV-07). */
export function mapOpenFoodFactsProduct(payload: unknown): FoodCandidate | null {
  const parsed = productSchema.safeParse(payload);
  if (!parsed.success) throw new ProviderResponseError('Open Food Facts schema error');
  const product = parsed.data;
  const name = sentenceCase(product.product_name ?? '');
  const externalId = product.code;
  if (!externalId || !name) return null;

  const n = product.nutriments;
  const energy =
    nutrient(n, 'energy-kcal_100g') ??
    (() => {
      const kj = nutrient(n, 'energy-kj_100g') ?? nutrient(n, 'energy_100g');
      return kj === null ? null : kj / 4.184;
    })();
  const protein = nutrient(n, 'proteins_100g');
  const carbohydrate = nutrient(n, 'carbohydrates_100g');
  const fat = nutrient(n, 'fat_100g');
  if (energy === null || (energy === 0 && protein === null && carbohydrate === null && fat === null)) return null;
  const macroKcal = 4 * (protein ?? 0) + 4 * (carbohydrate ?? 0) + 9 * (fat ?? 0);
  if (energy === 0 && macroKcal >= 20) return null;

  const serving = servingFromProduct(product);
  const basisUnit = serving?.unit ?? 'g';
  const servings: ServingInput[] = [
    { label: basisUnit, quantity: 1, unit: basisUnit, basisMultiplier: 0.01, isDefault: !serving },
  ];
  if (basisUnit === 'g') servings.push({ label: 'oz', quantity: 1, unit: 'oz', basisMultiplier: 0.028349523125 });
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
  return {
    externalId,
    input: {
      name,
      brand: brand(product.brands),
      basisQuantity: 100,
      basisUnit,
      nutrients: { energyKcal: energy, carbohydrateG: carbohydrate, proteinG: protein, fatG: fat },
      servings,
    },
  };
}

export function mapOpenFoodFactsSearch(payload: unknown): FoodCandidate[] {
  const response = z.object({ hits: z.array(z.unknown()) }).safeParse(payload);
  if (!response.success) throw new ProviderResponseError('Open Food Facts search schema error');
  return response.data.hits.flatMap((hit) => {
    const candidate = mapOpenFoodFactsProduct(hit);
    return candidate ? [candidate] : [];
  });
}
