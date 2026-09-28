import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import type { DiaryEntry } from '@/data/db/repositories/diaryRepository';
import type { Food, FoodServing } from '@/data/db/repositories/foodsRepository';
import { convertServingQuantity, initialServing } from '@/domain/food/servings';
import { servingNutrients } from '@/domain/nutrition/nutrients';
import { useAppSettings, useDiaryEntry, useDiaryWrites, useMeals } from '@/features/diary/diary.queries';
import { useDiaryDate } from '@/features/diary/hooks/DiaryDateContext';
import {
  AppBar,
  AppText,
  BottomSheet,
  ConfirmationDialog,
  FormField,
  InlineStatus,
  ListRow,
  NotFoundState,
  PrimaryButton,
  TextAction,
} from '@/shared/components';
import { formatEnergy, formatGrams, formatShortDate, relativeDay } from '@/shared/i18n/format';
import { useFormattingLocale } from '@/shared/i18n/useFormattingLocale';
import { MealPicker } from '@/shared/navigation/MealPicker';
import { routes, type FoodSource, type Origin } from '@/shared/navigation/routes';
import { useTheme } from '@/shared/theme';

import { ServingRuler } from '../components/ServingRuler';
import { useFood, useRecentFoods } from '../food-search.queries';

export type FoodDetailMode =
  | { kind: 'add'; foodId: string; foodSource: FoodSource; mealId: string; date: string; origin: Origin }
  | { kind: 'edit'; entryId: string; origin: Origin }
  | null;

/** UX-05/06 add and edit. Edit falls back to the entry snapshot when its source food/serving cannot resolve. */
export function FoodDetailScreen({ mode }: { mode: FoodDetailMode }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const editing = mode?.kind === 'edit';
  const entry = useDiaryEntry(editing ? mode.entryId : '', editing);
  const foodId = mode?.kind === 'add' ? mode.foodId : (entry.data?.foodId ?? '');
  const food = useFood(foodId, Boolean(foodId));
  const recents = useRecentFoods();
  const meals = useMeals();
  const settings = useAppSettings();
  const notFound = (
    <NotFoundState actionLabel={t('common.backToDiary')} onAction={() => router.dismissTo(routes.diary())} />
  );
  let body: React.ReactNode = null;

  if (!mode || (editing && entry.data && entry.data.kind !== 'food')) body = notFound;
  else if (mode.kind === 'add' && food.data && (food.data.isDeleted || food.data.source !== mode.foodSource)) {
    body = notFound;
  } else if (mode.kind === 'add' && food.data && recents.data && meals.data && settings.data) {
    const recent = recents.data.find((item) => item.foodId === food.data!.id);
    const selected = initialServing(
      food.data.servings,
      recent ? { servingId: recent.lastServingId, quantity: recent.lastServingQuantity } : null,
    );
    const initial = selected
      ? { serving: food.data.servings.find((item) => item.id === selected.serving.id)!, quantity: selected.quantity }
      : null;
    if (!initial || !meals.data.some((meal) => meal.id === mode.mealId)) body = notFound;
    else {
      body = (
        <FoodDetailForm
          key={food.data.id}
          mode={mode}
          food={food.data}
          initial={initial}
          meals={meals.data}
          energyUnit={settings.data.energyUnit}
          preferredUnits={[settings.data.foodWeightUnit, settings.data.volumeUnit]}
          allowServingChange
          entry={null}
        />
      );
    }
  } else if (
    mode.kind === 'edit' &&
    entry.data &&
    meals.data &&
    settings.data &&
    (food.data || food.isError || !foodId)
  ) {
    const resolvedServing =
      food.data && !food.data.isDeleted
        ? food.data.servings.find(
            (item) => item.label.trim().toLowerCase() === entry.data!.servingUnit?.trim().toLowerCase(),
          )
        : undefined;
    const resolvedFood = resolvedServing ? food.data! : snapshotFood(entry.data);
    body = (
      <FoodDetailForm
        key={entry.data.id}
        mode={{
          kind: 'edit',
          entryId: entry.data.id,
          origin: mode.origin,
          mealId: entry.data.mealId,
          date: entry.data.diaryDate,
        }}
        food={resolvedFood}
        initial={{ serving: resolvedServing ?? resolvedFood.servings[0]!, quantity: entry.data.servingQuantity! }}
        meals={meals.data}
        energyUnit={settings.data.energyUnit}
        preferredUnits={[settings.data.foodWeightUnit, settings.data.volumeUnit]}
        allowServingChange={Boolean(resolvedServing)}
        entry={entry.data}
      />
    );
  }
  if (
    !body &&
    (entry.isError || meals.isError || settings.isError || (mode?.kind === 'add' && (food.isError || recents.isError)))
  )
    body = notFound;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.canvas }}>
      <AppBar
        title={t(editing ? 'foodDetail.editTitle' : 'foodDetail.title')}
        back={{ label: t('common.back'), onPress: () => router.back() }}
      />
      {body}
    </View>
  );
}

function snapshotFood(entry: DiaryEntry): Food {
  const quantity = entry.servingQuantity!;
  const unit = entry.servingUnit!;
  return {
    id: entry.foodId ?? `snapshot-${entry.id}`,
    source: 'custom',
    externalId: null,
    name: entry.name,
    brand: entry.brand,
    basisQuantity: quantity,
    basisUnit: unit,
    nutrients: entry.nutrients,
    isDeleted: false,
    servings: [
      {
        id: `snapshot-${entry.id}`,
        label: unit,
        quantity: 1,
        unit,
        basisMultiplier: 1 / quantity,
        isDefault: true,
        sortOrder: 0,
      },
    ],
  };
}

function FoodDetailForm({
  mode,
  food,
  initial,
  meals,
  energyUnit,
  preferredUnits,
  allowServingChange,
  entry,
}: {
  mode:
    | Extract<NonNullable<FoodDetailMode>, { kind: 'add' }>
    | { kind: 'edit'; entryId: string; origin: Origin; mealId: string; date: string };
  food: Food;
  initial: { serving: FoodServing; quantity: number };
  meals: readonly { id: string; name: string }[];
  energyUnit: 'kcal' | 'kJ';
  preferredUnits: readonly string[];
  allowServingChange: boolean;
  entry: DiaryEntry | null;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const locale = useFormattingLocale();
  const { today, setDate } = useDiaryDate();
  const writes = useDiaryWrites();
  const [mealId, setMealId] = useState(mode.mealId);
  const [serving, setServing] = useState(initial.serving);
  const [quantity, setQuantity] = useState(initial.quantity);
  const [pickingMeal, setPickingMeal] = useState(false);
  const [pickingUnit, setPickingUnit] = useState(false);
  const [editingValue, setEditingValue] = useState(false);
  const [valueText, setValueText] = useState(String(initial.quantity));
  const [saveFailed, setSaveFailed] = useState(false);
  const [deleteFailed, setDeleteFailed] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const nutrients = useMemo(() => {
    if (entry && serving.label.trim().toLowerCase() === entry.servingUnit?.trim().toLowerCase()) {
      const factor = quantity / entry.servingQuantity!;
      const scale = (value: number | null) => (value === null ? null : value * factor);
      return {
        energyKcal: entry.nutrients.energyKcal * factor,
        carbohydrateG: scale(entry.nutrients.carbohydrateG),
        proteinG: scale(entry.nutrients.proteinG),
        fatG: scale(entry.nutrients.fatG),
      };
    }
    return servingNutrients(food.nutrients, serving, quantity);
  }, [entry, food.nutrients, quantity, serving]);
  const mealName = meals.find((meal) => meal.id === mealId)?.name ?? '';
  const relative = relativeDay(mode.date, today);
  const dateLabel = relative ? t(`diary.${relative}`) : formatShortDate(mode.date, today, locale);
  const orderedServings = useMemo(
    () =>
      [...food.servings].sort((a, b) => {
        const aRank = preferredUnits.indexOf(a.unit);
        const bRank = preferredUnits.indexOf(b.unit);
        return (aRank < 0 ? preferredUnits.length : aRank) - (bRank < 0 ? preferredUnits.length : bRank);
      }),
    [food.servings, preferredUnits],
  );
  const visibleUnits = orderedServings.length > 3 ? orderedServings.slice(0, 2) : orderedServings;
  const chooseServing = (next: FoodServing) => {
    setQuantity(convertServingQuantity(quantity, serving, next));
    setServing(next);
    setPickingUnit(false);
  };
  const save = async () => {
    setSaveFailed(false);
    try {
      if (mode.kind === 'add') {
        await writes.addFoodEntry.mutateAsync({
          diaryDate: mode.date,
          mealId,
          foodId: food.id,
          servingId: serving.id,
          quantity,
        });
        setDate(mode.date);
        // NAV-04: a meal-specific add returns past Food Search to its Meal Detail.
        // Global and Diary flows end on the target Diary date (NAV-03).
        if (mode.origin === 'mealDetail') router.dismiss(2);
        else router.dismissTo(routes.diary());
      } else {
        await writes.editFoodEntry.mutateAsync({
          id: mode.entryId,
          mealId,
          quantity,
          ...(allowServingChange ? { servingId: serving.id } : {}),
        });
        if (mode.origin === 'mealDetail' && mealId !== mode.mealId) router.dismissTo(routes.diary());
        else router.back();
      }
    } catch {
      setSaveFailed(true);
    }
  };
  const remove = async () => {
    setConfirmingDelete(false);
    setDeleteFailed(false);
    try {
      await writes.deleteEntry.mutateAsync(entry!.id);
      router.back();
    } catch {
      setDeleteFailed(true);
    }
  };
  const applyNumeric = () => {
    const parsed = Number(valueText.trim().replace(',', '.'));
    if (!(parsed > 0) || !Number.isFinite(parsed) || !/^\d+(?:[.,]\d{1,2})?$/.test(valueText.trim())) return;
    setQuantity(parsed);
    setEditingValue(false);
  };

  return (
    <>
      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingVertical: theme.spacing[4], gap: theme.spacing[4] }}>
          <View style={{ paddingHorizontal: theme.spacing[4], gap: theme.spacing[1] }}>
            <View style={{ flexDirection: 'row', gap: theme.spacing[3], alignItems: 'baseline' }}>
              <AppText variant="sectionTitle" style={{ flex: 1 }}>
                {food.name}
              </AppText>
              <AppText variant="bodyStrong" tabular>
                {formatEnergy(nutrients.energyKcal, energyUnit, locale)} {t(`diary.units.${energyUnit}`)}
              </AppText>
            </View>
            <AppText color="textSecondary">
              {food.brand || t('foodSearch.perBasis', { quantity: food.basisQuantity, unit: food.basisUnit })}
            </AppText>
          </View>
          <View style={{ paddingHorizontal: theme.spacing[4] }}>
            <ServingRuler
              quantity={quantity}
              serving={serving}
              energyKcal={nutrients.energyKcal}
              energyUnit={energyUnit}
              onChange={setQuantity}
              onOpenNumeric={() => {
                setValueText(String(quantity));
                setEditingValue(true);
              }}
            />
          </View>
          {allowServingChange ? (
            <View style={{ flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: theme.spacing[3] }}>
              {visibleUnits.map((unit) => (
                <TextAction
                  key={unit.id}
                  label={unit.label}
                  onPress={() => chooseServing(unit)}
                  selected={unit.id === serving.id}
                />
              ))}
              {orderedServings.length > 3 ? (
                <TextAction label={t('foodDetail.moreUnits')} onPress={() => setPickingUnit(true)} />
              ) : null}
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: theme.spacing[4] }}>
            <Macro label={t('foodDetail.carbs')} value={nutrients.carbohydrateG} locale={locale} />
            <Macro label={t('foodDetail.protein')} value={nutrients.proteinG} locale={locale} />
            <Macro label={t('foodDetail.fat')} value={nutrients.fatG} locale={locale} />
          </View>
          <View>
            <ListRow label={t('foodDetail.meal')} value={mealName} onPress={() => setPickingMeal(true)} navigates />
            <ListRow label={t('foodDetail.date')} value={dateLabel} />
          </View>
          {mode.kind === 'edit' ? (
            <View style={{ paddingHorizontal: theme.spacing[4] }}>
              <TextAction
                label={t('foodDetail.delete')}
                onPress={() => setConfirmingDelete(true)}
                tone="danger"
                testID="food-entry-delete"
              />
            </View>
          ) : null}
        </ScrollView>
        <View style={{ padding: theme.spacing[4], gap: theme.spacing[2], backgroundColor: theme.colors.canvas }}>
          {saveFailed ? <InlineStatus tone="error" message={t('foodDetail.saveError')} /> : null}
          {deleteFailed ? <InlineStatus tone="error" message={t('foodDetail.deleteError')} /> : null}
          <PrimaryButton
            label={mode.kind === 'add' ? t('foodDetail.addTo', { meal: mealName }) : t('foodDetail.save')}
            onPress={() => void save()}
            loading={writes.addFoodEntry.isPending || writes.editFoodEntry.isPending}
            disabled={writes.addFoodEntry.isPending || writes.editFoodEntry.isPending}
            fullWidth
            testID={mode.kind === 'add' ? 'food-detail-add' : 'food-entry-save'}
          />
        </View>
      </View>
      <MealPicker
        visible={pickingMeal}
        meals={meals}
        selectedId={mealId}
        onSelect={(id) => {
          setMealId(id);
          setPickingMeal(false);
        }}
        onClose={() => setPickingMeal(false)}
      />
      <BottomSheet
        visible={pickingUnit}
        onClose={() => setPickingUnit(false)}
        accessibilityLabel={t('foodDetail.chooseUnit')}
        closeLabel={t('common.close')}
        testID="serving-unit-picker"
      >
        {orderedServings.map((unit) => (
          <ListRow
            key={unit.id}
            label={unit.label}
            value={t('foodDetail.conversionHint', { quantity: unit.quantity, unit: unit.unit })}
            onPress={() => chooseServing(unit)}
          />
        ))}
      </BottomSheet>
      <BottomSheet
        visible={editingValue}
        onClose={() => setEditingValue(false)}
        accessibilityLabel={t('foodDetail.enterServing')}
        closeLabel={t('common.close')}
        // UX screens rule: the primary action (Done) stays above the keypad, never behind it (iOS decimal pad).
        avoidKeyboard
        testID="serving-value-sheet"
      >
        <View style={{ paddingHorizontal: theme.spacing[4], paddingBottom: theme.spacing[4], gap: theme.spacing[3] }}>
          <FormField
            label={t('foodDetail.serving')}
            value={valueText}
            onChangeText={setValueText}
            keyboardType="decimal-pad"
            returnKeyType="done"
            onSubmitEditing={applyNumeric}
            unit={serving.label}
            autoFocus
            testID="serving-value-input"
          />
          <PrimaryButton label={t('foodDetail.done')} onPress={applyNumeric} fullWidth testID="serving-value-confirm" />
        </View>
      </BottomSheet>
      {mode.kind === 'edit' ? (
        <ConfirmationDialog
          visible={confirmingDelete}
          title={t('foodDetail.deleteTitle')}
          body={t('foodDetail.deleteBody', {
            name: entry!.name,
            quantity: entry!.servingQuantity,
            unit: entry!.servingUnit,
            meal: meals.find((item) => item.id === entry!.mealId)?.name ?? '',
            date: formatShortDate(entry!.diaryDate, today, locale),
          })}
          confirmLabel={t('foodDetail.delete')}
          cancelLabel={t('common.cancel')}
          destructive
          onConfirm={() => void remove()}
          onCancel={() => setConfirmingDelete(false)}
          testID="food-entry-delete-dialog"
        />
      ) : null}
    </>
  );
}

function Macro({ label, value, locale }: { label: string; value: number | null; locale: string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <AppText variant="label" color="textSecondary">
        {label}
      </AppText>
      <AppText tabular>{value === null ? '—' : `${formatGrams(value, locale)} g`}</AppText>
    </View>
  );
}
