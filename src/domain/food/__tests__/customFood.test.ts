import type { CustomFoodInput, Food } from '@/data/db/repositories/foodsRepository';
import { G_PER_OZ, ML_PER_FL_OZ } from '@/domain/units/units';

import {
  CUSTOM_FOOD_NUTRIENT_IDS,
  customFoodFormFromFood,
  customFoodFormSchema,
  customFoodInputFromForm,
  parseLocalizedDecimal,
  type CustomFoodFormValues,
} from '../customFood';

const valid: CustomFoodFormValues = {
  name: 'Scrambled eggs',
  brand: '',
  servingAmount: '2',
  servingUnit: 'other',
  otherUnit: 'egg',
  energy: '156',
  protein: '13',
  carbohydrate: '1',
  fat: '11',
};

describe('ARCH-22 / UX-08: localized custom-food input', () => {
  it('does not need Intl formatToParts (missing on iOS Hermes)', () => {
    const spy = jest.spyOn(Intl.NumberFormat.prototype, 'formatToParts').mockImplementation(() => {
      throw new TypeError('undefined is not a function');
    });
    expect(parseLocalizedDecimal('12,5', 'pt-PT')).toBe(12.5);
    expect(parseLocalizedDecimal('180.5', 'en-US')).toBe(180.5);
    spy.mockRestore();
  });

  it('accepts the locale decimal separator and at most two decimal places', () => {
    expect(parseLocalizedDecimal(' 12.25 ', 'en-GB')).toBe(12.25);
    expect(parseLocalizedDecimal('12,25', 'pt-PT')).toBe(12.25);
    expect(parseLocalizedDecimal('12.25', 'pt-PT')).toBeNull();
    expect(parseLocalizedDecimal('1,234.5', 'en-GB')).toBeNull();
    expect(parseLocalizedDecimal('1.234', 'en-GB')).toBeNull();
  });

  it('ARCH-03 / UX-00: validates required fields and canonical ranges', () => {
    expect(customFoodFormSchema('en-GB', 'kcal').safeParse(valid).success).toBe(true);
    expect(
      customFoodFormSchema('en-GB', 'kcal').safeParse({
        ...valid,
        name: ' ',
        servingAmount: '0',
        otherUnit: ' ',
        energy: '10001',
        protein: '1001',
      }).success,
    ).toBe(false);
    expect(customFoodFormSchema('en-GB', 'kJ').safeParse({ ...valid, energy: '41840' }).success).toBe(true);
  });
});

describe('DATA-04 / DATA-11 / UX-08: custom-food command', () => {
  it('maps a count serving to nutrition per entered amount', () => {
    expect(customFoodInputFromForm(valid, 'en-GB', 'kcal')).toEqual({
      name: 'Scrambled eggs',
      brand: null,
      basisQuantity: 2,
      basisUnit: 'egg',
      nutrients: { energyKcal: 156, proteinG: 13, carbohydrateG: 1, fatG: 11 },
      servings: [{ label: 'egg', quantity: 1, unit: 'egg', basisMultiplier: 0.5, isDefault: true }],
    });
  });

  it('stores oz as canonical grams and offers both mass units with the selected default', () => {
    const input = customFoodInputFromForm(
      { ...valid, servingAmount: '2', servingUnit: 'oz', otherUnit: '' },
      'en-GB',
      'kcal',
    )!;
    expect(input.basisQuantity).toBe(2 * G_PER_OZ);
    expect(input.basisUnit).toBe('g');
    expect(input.servings).toEqual([
      expect.objectContaining({ label: 'g', basisMultiplier: 1 / (2 * G_PER_OZ), isDefault: false }),
      expect.objectContaining({ label: 'oz', basisMultiplier: 0.5, isDefault: true }),
    ]);
  });

  it('stores fl oz as canonical ml and converts display energy to kcal', () => {
    const input = customFoodInputFromForm(
      { ...valid, servingAmount: '1,5', servingUnit: 'fl_oz', otherUnit: '', energy: '418,4' },
      'pt-PT',
      'kJ',
    )!;
    expect(input.basisQuantity).toBe(1.5 * ML_PER_FL_OZ);
    expect(input.basisUnit).toBe('ml');
    expect(input.nutrients.energyKcal).toBeCloseTo(100, 10);
    expect(input.servings[1]).toMatchObject({ label: 'fl oz', basisMultiplier: 2 / 3, isDefault: true });
  });

  it('maps omitted macros to unknown nutrition', () => {
    expect(
      customFoodInputFromForm({ ...valid, protein: '', carbohydrate: '', fat: '' }, 'en-GB', 'kcal')?.nutrients,
    ).toEqual({
      energyKcal: 156,
      proteinG: null,
      carbohydrateG: null,
      fatG: null,
    });
  });

  it('UX-08 / DATA-20: maps More nutrients per the entered serving; empty fields stay unknown', () => {
    const input = customFoodInputFromForm(
      { ...valid, extra: { fibre: '2,5', salt: '0,3', iron: '', vitamin_d: '1' } },
      'pt-PT',
      'kcal',
    );
    expect(input?.nutrients.extra).toEqual({ fibre: 2.5, salt: 0.3, vitamin_d: 1 });
    expect(customFoodInputFromForm({ ...valid, extra: { fibre: '' } }, 'en-GB', 'kcal')?.nutrients).not.toHaveProperty(
      'extra',
    );
  });

  it('UX-08: validates each nutrient from 0 to the macro bound in its own unit; sodium is not offered', () => {
    const schema = customFoodFormSchema('en-GB', 'kcal');
    const issues = (extra: CustomFoodFormValues['extra']) =>
      schema.safeParse({ ...valid, extra }).error?.issues.map((issue) => issue.path.join('.')) ?? [];
    expect(issues({ fibre: '1000', cholesterol: '1000000', vitamin_d: '1000000000' })).toEqual([]);
    expect(issues({ fibre: '1000.01', cholesterol: '-1', caffeine: 'abc' })).toEqual([
      'extra.fibre',
      'extra.cholesterol',
      'extra.caffeine',
    ]);
    expect(issues({ alcohol: '5' } as never)).toEqual(['extra.alcohol']);
    expect(CUSTOM_FOOD_NUTRIENT_IDS).not.toContain('sodium');
    expect(CUSTOM_FOOD_NUTRIENT_IDS).toHaveLength(27);
  });
});

describe('UX-25 / DATA-26: edit form values from a stored custom food', () => {
  const stored = (input: CustomFoodInput): Food => ({
    ...input,
    kind: 'food',
    brand: input.brand ?? null,
    barcode: null,
    id: 'food-1',
    source: 'custom',
    externalId: null,
    isDeleted: false,
    servings: input.servings.map((serving, index) => ({
      ...serving,
      id: `serving-${index}`,
      isDefault: serving.isDefault ?? index === 0,
      sortOrder: index,
    })),
  });
  const cases: [string, CustomFoodFormValues, string, 'kcal' | 'kJ'][] = [
    ['other unit', valid, 'en-GB', 'kcal'],
    [
      'oz with unknown macros, pt-PT',
      { ...valid, servingAmount: '1,5', servingUnit: 'oz', otherUnit: '', carbohydrate: '', energy: '200,25' },
      'pt-PT',
      'kcal',
    ],
    [
      'fl oz in kJ',
      { ...valid, servingAmount: '8', servingUnit: 'fl_oz', otherUnit: '', energy: '500' },
      'en-GB',
      'kJ',
    ],
    [
      'g with more nutrients',
      {
        ...valid,
        brand: 'Home',
        servingAmount: '100',
        servingUnit: 'g',
        otherUnit: '',
        extra: { fibre: '2.5', salt: '0.3' },
      },
      'en-GB',
      'kcal',
    ],
  ];

  it.each(cases)('%s: maps back to the values that created it', (_name, form, locale, energyUnit) => {
    const input = customFoodInputFromForm(form, locale, energyUnit)!;
    const values = customFoodFormFromFood(stored(input), locale, energyUnit);
    expect(values).toEqual({ extra: {}, ...form });
    expect(customFoodInputFromForm(values, locale, energyUnit)).toEqual(input);
  });
});
