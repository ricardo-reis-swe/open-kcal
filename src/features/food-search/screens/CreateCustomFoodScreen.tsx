import { Controller, useForm, useWatch, type FieldErrors, type Resolver } from 'react-hook-form';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, ScrollView, View } from 'react-native';

import type { Food } from '@/data/db/repositories/foodsRepository';
import {
  CUSTOM_FOOD_AMOUNT_MAX,
  CUSTOM_FOOD_ENERGY_MAX_KCAL,
  CUSTOM_FOOD_MACRO_MAX_G,
  CUSTOM_FOOD_NAME_MAX,
  customFoodFormSchema,
  customFoodInputFromForm,
  type CustomFoodFormValues,
  type CustomServingUnit,
} from '@/domain/food/customFood';
import { energyFromKcal } from '@/domain/units/units';
import { useAppSettings } from '@/features/diary/diary.queries';
import {
  AppBar,
  AppText,
  ConfirmationDialog,
  FormField,
  InlineStatus,
  PrimaryButton,
  SectionHeader,
} from '@/shared/components';
import { FocusablePressable } from '@/shared/components/FocusablePressable';
import { formatInteger } from '@/shared/i18n/format';
import { useFormattingLocale } from '@/shared/i18n/useFormattingLocale';
import { useTheme } from '@/shared/theme';

import { useLocalFoodWrites } from '../food-search.queries';

type Props = {
  initialName?: string;
  onCancel: () => void;
  onSaved: (food: Food) => void;
};

const SERVING_UNITS: readonly CustomServingUnit[] = ['g', 'oz', 'ml', 'fl_oz', 'other'];

/** UX-08 Create Custom Food. Saving creates the food only; the route continues to Food Detail (NAV-04). */
export function CreateCustomFoodScreen({ initialName = '', onCancel, onSaved }: Props) {
  const theme = useTheme();
  const settings = useAppSettings();
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.canvas }}>
      {settings.data ? (
        <CustomFoodForm
          initialName={initialName}
          energyUnit={settings.data.energyUnit}
          initialServingUnit={settings.data.foodWeightUnit}
          onCancel={onCancel}
          onSaved={onSaved}
        />
      ) : null}
    </View>
  );
}

function CustomFoodForm({
  initialName,
  energyUnit,
  initialServingUnit,
  onCancel,
  onSaved,
}: {
  initialName: string;
  energyUnit: 'kcal' | 'kJ';
  initialServingUnit: 'g' | 'oz';
  onCancel: () => void;
  onSaved: (food: Food) => void;
}) {
  const { t } = useTranslation();
  const locale = useFormattingLocale();
  const theme = useTheme();
  const writes = useLocalFoodWrites();
  const schema = customFoodFormSchema(locale, energyUnit);
  const resolver: Resolver<CustomFoodFormValues> = async (values) => {
    const result = schema.safeParse(values);
    if (result.success) return { values: result.data, errors: {} };
    const errors: FieldErrors<CustomFoodFormValues> = {};
    for (const issue of result.error.issues) {
      const field = issue.path[0] as keyof CustomFoodFormValues | undefined;
      if (field) errors[field] ??= { type: 'validate', message: issue.message };
    }
    return { values: {}, errors };
  };
  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors, isDirty, isSubmitting, isValid, submitCount, touchedFields },
  } = useForm<CustomFoodFormValues>({
    defaultValues: {
      name: initialName,
      brand: '',
      servingAmount: '',
      servingUnit: initialServingUnit,
      otherUnit: '',
      energy: '',
      protein: '',
      carbohydrate: '',
      fat: '',
    },
    // UX-00: surface feedback both when a field loses focus and as soon as it becomes valid again.
    mode: 'all',
    resolver,
  });
  const servingUnit = useWatch({ control, name: 'servingUnit' });
  const servingAmount = useWatch({ control, name: 'servingAmount' });
  const otherUnit = useWatch({ control, name: 'otherUnit' });
  const [discarding, setDiscarding] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  const fieldError = (field: keyof CustomFoodFormValues, message: string) =>
    errors[field] && (touchedFields[field] || submitCount > 0) ? message : undefined;
  const unitLabel =
    servingUnit === 'other' ? otherUnit.trim() || t('customFood.units.other') : t(`customFood.units.${servingUnit}`);
  const nutritionBasis =
    servingAmount && unitLabel
      ? t('customFood.nutritionPer', { amount: servingAmount, unit: unitLabel })
      : t('customFood.nutrition');
  const energyMax = formatInteger(energyFromKcal(CUSTOM_FOOD_ENERGY_MAX_KCAL, energyUnit), locale);
  const servingAmountMax = formatInteger(CUSTOM_FOOD_AMOUNT_MAX, locale);
  const requestCancel = () => {
    if (isDirty) setDiscarding(true);
    else onCancel();
  };
  const submit = async (values: CustomFoodFormValues) => {
    const input = customFoodInputFromForm(values, locale, energyUnit);
    if (!input) return;
    setSaveFailed(false);
    try {
      onSaved(await writes.createCustom.mutateAsync(input));
    } catch {
      setSaveFailed(true);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <AppBar title={t('customFood.title')} back={{ label: t('common.back'), onPress: requestCancel }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView
          style={{ flex: 1 }}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingVertical: theme.spacing[4], gap: theme.spacing[4] }}
        >
          <View style={{ paddingHorizontal: theme.spacing[4], gap: theme.spacing[4] }}>
            <Controller
              control={control}
              name="name"
              render={({ field }) => (
                <FormField
                  label={t('customFood.name')}
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  autoCapitalize="words"
                  autoFocus
                  maxLength={CUSTOM_FOOD_NAME_MAX}
                  error={fieldError('name', t('customFood.errors.name'))}
                  testID="custom-food-name"
                />
              )}
            />
            <Controller
              control={control}
              name="brand"
              render={({ field }) => (
                <FormField
                  label={t('customFood.brand')}
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  maxLength={CUSTOM_FOOD_NAME_MAX}
                  testID="custom-food-brand"
                />
              )}
            />
            <Controller
              control={control}
              name="servingAmount"
              render={({ field }) => (
                <FormField
                  label={t('customFood.serving')}
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  keyboardType="decimal-pad"
                  unit={unitLabel}
                  error={fieldError('servingAmount', t('customFood.errors.amount', { max: servingAmountMax }))}
                  testID="custom-food-serving"
                />
              )}
            />
            <ServingUnitControl
              value={servingUnit}
              onChange={(unit) => setValue('servingUnit', unit, { shouldDirty: true, shouldValidate: true })}
            />
            {servingUnit === 'other' ? (
              <Controller
                control={control}
                name="otherUnit"
                render={({ field }) => (
                  <FormField
                    label={t('customFood.otherUnit')}
                    value={field.value}
                    onChangeText={field.onChange}
                    onBlur={field.onBlur}
                    autoCapitalize="none"
                    error={fieldError('otherUnit', t('customFood.errors.otherUnit'))}
                    testID="custom-food-other-unit"
                  />
                )}
              />
            ) : null}
          </View>
          <SectionHeader label={nutritionBasis} uppercase />
          <View style={{ paddingHorizontal: theme.spacing[4], gap: theme.spacing[4] }}>
            <Controller
              control={control}
              name="energy"
              render={({ field }) => (
                <FormField
                  label={t('customFood.calories')}
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  keyboardType="decimal-pad"
                  unit={t(`diary.units.${energyUnit}`)}
                  error={fieldError('energy', t('customFood.errors.energy', { max: energyMax, unit: energyUnit }))}
                  testID="custom-food-energy"
                />
              )}
            />
            {(['protein', 'carbohydrate', 'fat'] as const).map((fieldName) => (
              <Controller
                key={fieldName}
                control={control}
                name={fieldName}
                render={({ field }) => (
                  <FormField
                    label={t(`customFood.${fieldName}`)}
                    value={field.value}
                    onChangeText={field.onChange}
                    onBlur={field.onBlur}
                    keyboardType="decimal-pad"
                    unit={t('diary.units.g')}
                    helper={fieldName === 'carbohydrate' ? t('customFood.carbsHelper') : undefined}
                    error={fieldError(fieldName, t('customFood.errors.macro', { max: CUSTOM_FOOD_MACRO_MAX_G }))}
                    testID={`custom-food-${fieldName}`}
                  />
                )}
              />
            ))}
          </View>
        </ScrollView>
        <View style={{ padding: theme.spacing[4], gap: theme.spacing[2], backgroundColor: theme.colors.canvas }}>
          {saveFailed ? <InlineStatus tone="error" message={t('customFood.saveError')} /> : null}
          <PrimaryButton
            label={t('customFood.save')}
            onPress={() => void handleSubmit(submit)()}
            disabled={!isValid || isSubmitting}
            loading={isSubmitting}
            fullWidth
            testID="custom-food-save"
          />
        </View>
      </KeyboardAvoidingView>
      <ConfirmationDialog
        visible={discarding}
        title={t('customFood.discardTitle')}
        confirmLabel={t('customFood.discard')}
        cancelLabel={t('customFood.keepEditing')}
        destructive
        onConfirm={onCancel}
        onCancel={() => setDiscarding(false)}
        testID="custom-food-discard"
      />
    </View>
  );
}

function ServingUnitControl({
  value,
  onChange,
}: {
  value: CustomServingUnit;
  onChange: (unit: CustomServingUnit) => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[2] }}>
      {SERVING_UNITS.map((unit) => {
        const selected = unit === value;
        return (
          <FocusablePressable
            key={unit}
            accessibilityRole="radio"
            accessibilityLabel={t(`customFood.units.${unit}`)}
            accessibilityState={{ selected }}
            onPress={() => onChange(unit)}
            style={{
              minHeight: theme.touchMin,
              justifyContent: 'center',
              paddingHorizontal: theme.spacing[3],
              borderRadius: theme.radii.pill,
              borderWidth: 1,
              borderColor: selected ? theme.colors.primary : theme.colors.borderStrong,
              backgroundColor: selected ? theme.colors.primaryTint : theme.colors.surface,
            }}
          >
            <AppText variant="compactStrong" color={selected ? 'primary' : 'textPrimary'}>
              {t(`customFood.units.${unit}`)}
            </AppText>
          </FocusablePressable>
        );
      })}
    </View>
  );
}
