// Create Custom Food form boundary and canonical command mapping (ARCH-03, DATA-04/11, UX-08).
import { z } from 'zod';

import type { CustomFoodInput, ServingInput } from '@/data/db/repositories/foodsRepository';
import { G_PER_OZ, ML_PER_FL_OZ, energyToKcal, type EnergyUnit } from '@/domain/units/units';

export const CUSTOM_FOOD_NAME_MAX = 80;
export const CUSTOM_FOOD_AMOUNT_MAX = 10_000;
export const CUSTOM_FOOD_MACRO_MAX_G = 1_000;
export const CUSTOM_FOOD_ENERGY_MAX_KCAL = 10_000;

export const customServingUnitSchema = z.enum(['g', 'oz', 'ml', 'fl_oz', 'other']);
export type CustomServingUnit = z.infer<typeof customServingUnitSchema>;

export type CustomFoodFormValues = {
  name: string;
  brand: string;
  servingAmount: string;
  servingUnit: CustomServingUnit;
  otherUnit: string;
  energy: string;
  protein: string;
  carbohydrate: string;
  fat: string;
};

// Hermes on iOS has no `NumberFormat.prototype.formatToParts`: read the separator from `format(1.1)` instead.
function decimalSeparator(locale: string): string {
  return new Intl.NumberFormat(locale).format(1.1).replace(/\d/g, '') || '.';
}

/** UX-00 / ARCH-22: parse an ungrouped decimal-pad value using the app locale, with at most two decimals. */
export function parseLocalizedDecimal(text: string, locale: string): number | null {
  const value = text.trim();
  const separator = decimalSeparator(locale);
  const escaped = separator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (!new RegExp(`^\\d+(?:${escaped}\\d{1,2})?$`).test(value)) return null;
  const parsed = Number(value.replace(separator, '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function inRange(value: number | null, min: number, max: number): value is number {
  return value !== null && value >= min && value <= max;
}

/** ARCH-03 / UX-08: validates every field in display units at the form boundary. */
export function customFoodFormSchema(locale: string, energyUnit: EnergyUnit) {
  return z
    .object({
      name: z.string().trim().min(1).max(CUSTOM_FOOD_NAME_MAX),
      brand: z.string().trim().max(CUSTOM_FOOD_NAME_MAX),
      servingAmount: z.string(),
      servingUnit: customServingUnitSchema,
      otherUnit: z.string(),
      energy: z.string(),
      protein: z.string(),
      carbohydrate: z.string(),
      fat: z.string(),
    })
    .superRefine((values, context) => {
      const amount = parseLocalizedDecimal(values.servingAmount, locale);
      if (!inRange(amount, Number.EPSILON, CUSTOM_FOOD_AMOUNT_MAX)) {
        context.addIssue({ code: 'custom', path: ['servingAmount'], message: 'range' });
      }
      if (values.servingUnit === 'other' && values.otherUnit.trim().length === 0) {
        context.addIssue({ code: 'custom', path: ['otherUnit'], message: 'required' });
      }
      const energy = parseLocalizedDecimal(values.energy, locale);
      const energyKcal = energy === null ? null : energyToKcal(energy, energyUnit);
      if (!inRange(energyKcal, 1, CUSTOM_FOOD_ENERGY_MAX_KCAL)) {
        context.addIssue({ code: 'custom', path: ['energy'], message: 'range' });
      }
      for (const field of ['protein', 'carbohydrate', 'fat'] as const) {
        if (!inRange(parseLocalizedDecimal(values[field], locale), 0, CUSTOM_FOOD_MACRO_MAX_G)) {
          context.addIssue({ code: 'custom', path: [field], message: 'range' });
        }
      }
    });
}

function massServings(basisQuantityG: number, selected: 'g' | 'oz'): ServingInput[] {
  return [
    { label: 'g', quantity: 1, unit: 'g', basisMultiplier: 1 / basisQuantityG, isDefault: selected === 'g' },
    {
      label: 'oz',
      quantity: 1,
      unit: 'oz',
      basisMultiplier: G_PER_OZ / basisQuantityG,
      isDefault: selected === 'oz',
    },
  ];
}

function volumeServings(basisQuantityMl: number, selected: 'ml' | 'fl_oz'): ServingInput[] {
  return [
    { label: 'ml', quantity: 1, unit: 'ml', basisMultiplier: 1 / basisQuantityMl, isDefault: selected === 'ml' },
    {
      label: 'fl oz',
      quantity: 1,
      unit: 'fl_oz',
      basisMultiplier: ML_PER_FL_OZ / basisQuantityMl,
      isDefault: selected === 'fl_oz',
    },
  ];
}

/** Converts a validated UX-08 form into canonical storage units and complete selectable servings (DATA-04/11). */
export function customFoodInputFromForm(
  raw: CustomFoodFormValues,
  locale: string,
  energyUnit: EnergyUnit,
): CustomFoodInput | null {
  const parsed = customFoodFormSchema(locale, energyUnit).safeParse(raw);
  if (!parsed.success) return null;
  const values = parsed.data;
  const amount = parseLocalizedDecimal(values.servingAmount, locale)!;
  const energy = parseLocalizedDecimal(values.energy, locale)!;
  let basisQuantity: number;
  let basisUnit: string;
  let servings: ServingInput[];

  switch (values.servingUnit) {
    case 'g':
    case 'oz': {
      basisQuantity = values.servingUnit === 'g' ? amount : amount * G_PER_OZ;
      basisUnit = 'g';
      servings = massServings(basisQuantity, values.servingUnit);
      break;
    }
    case 'ml':
    case 'fl_oz': {
      basisQuantity = values.servingUnit === 'ml' ? amount : amount * ML_PER_FL_OZ;
      basisUnit = 'ml';
      servings = volumeServings(basisQuantity, values.servingUnit);
      break;
    }
    case 'other': {
      const label = values.otherUnit.trim();
      basisQuantity = amount;
      basisUnit = label;
      servings = [{ label, quantity: 1, unit: label, basisMultiplier: 1 / amount, isDefault: true }];
      break;
    }
  }

  return {
    name: values.name.trim(),
    brand: values.brand.trim() || null,
    basisQuantity,
    basisUnit,
    nutrients: {
      energyKcal: energyToKcal(energy, energyUnit),
      proteinG: parseLocalizedDecimal(values.protein, locale)!,
      carbohydrateG: parseLocalizedDecimal(values.carbohydrate, locale)!,
      fatG: parseLocalizedDecimal(values.fat, locale)!,
    },
    servings,
  };
}
