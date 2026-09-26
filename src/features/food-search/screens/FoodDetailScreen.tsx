import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import type { Food, FoodServing } from '@/data/db/repositories/foodsRepository';
import { convertServingQuantity, initialServing } from '@/domain/food/servings';
import { servingNutrients } from '@/domain/nutrition/nutrients';
import { useAppSettings, useDiaryWrites, useMeals } from '@/features/diary/diary.queries';
import { useDiaryDate } from '@/features/diary/hooks/DiaryDateContext';
import {
  AppBar,
  AppText,
  BottomSheet,
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

export type FoodDetailMode = {
  foodId: string;
  foodSource: FoodSource;
  mealId: string;
  date: string;
  origin: Origin;
} | null;

/** UX-05 Food Detail / Add Entry. The route reloads the food by ID and writes a full entry snapshot (NAV-09). */
export function FoodDetailScreen({ mode }: { mode: FoodDetailMode }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const food = useFood(mode?.foodId ?? '', Boolean(mode));
  const recents = useRecentFoods();
  const meals = useMeals();
  const settings = useAppSettings();
  const notFound = (
    <NotFoundState actionLabel={t('common.backToDiary')} onAction={() => router.dismissTo(routes.diary())} />
  );
  let body: React.ReactNode = null;

  if (!mode) body = notFound;
  else if (food.data && (food.data.isDeleted || food.data.source !== mode.foodSource)) body = notFound;
  else if (food.data && recents.data && meals.data && settings.data) {
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
        />
      );
    }
  }
  if (!body && (food.isError || recents.isError || meals.isError || settings.isError)) body = notFound;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.canvas }}>
      <AppBar title={t('foodDetail.title')} back={{ label: t('common.back'), onPress: () => router.back() }} />
      {body}
    </View>
  );
}

function FoodDetailForm({
  mode,
  food,
  initial,
  meals,
  energyUnit,
  preferredUnits,
}: {
  mode: NonNullable<FoodDetailMode>;
  food: Food;
  initial: { serving: FoodServing; quantity: number };
  meals: readonly { id: string; name: string }[];
  energyUnit: 'kcal' | 'kJ';
  preferredUnits: readonly string[];
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
  const nutrients = useMemo(
    () => servingNutrients(food.nutrients, serving, quantity),
    [food.nutrients, quantity, serving],
  );
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
      await writes.addFoodEntry.mutateAsync({
        diaryDate: mode.date,
        mealId,
        foodId: food.id,
        servingId: serving.id,
        quantity,
      });
      setDate(mode.date);
      router.dismissTo(routes.diary());
    } catch {
      setSaveFailed(true);
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
          <View style={{ flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: theme.spacing[3] }}>
            {visibleUnits.map((unit) => (
              <TextAction key={unit.id} label={unit.label} onPress={() => chooseServing(unit)} />
            ))}
            {orderedServings.length > 3 ? (
              <TextAction label={t('foodDetail.moreUnits')} onPress={() => setPickingUnit(true)} />
            ) : null}
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: theme.spacing[4] }}>
            <Macro label={t('foodDetail.carbs')} value={nutrients.carbohydrateG} locale={locale} />
            <Macro label={t('foodDetail.protein')} value={nutrients.proteinG} locale={locale} />
            <Macro label={t('foodDetail.fat')} value={nutrients.fatG} locale={locale} />
          </View>
          <View>
            <ListRow label={t('foodDetail.meal')} value={mealName} onPress={() => setPickingMeal(true)} navigates />
            <ListRow label={t('foodDetail.date')} value={dateLabel} />
          </View>
        </ScrollView>
        <View style={{ padding: theme.spacing[4], gap: theme.spacing[2], backgroundColor: theme.colors.canvas }}>
          {saveFailed ? <InlineStatus tone="error" message={t('foodDetail.saveError')} /> : null}
          <PrimaryButton
            label={t('foodDetail.addTo', { meal: mealName })}
            onPress={() => void save()}
            loading={writes.addFoodEntry.isPending}
            disabled={writes.addFoodEntry.isPending}
            fullWidth
            testID="food-detail-add"
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
        testID="serving-value-sheet"
      >
        <View style={{ paddingHorizontal: theme.spacing[4], paddingBottom: theme.spacing[4], gap: theme.spacing[3] }}>
          <FormField
            label={t('foodDetail.serving')}
            value={valueText}
            onChangeText={setValueText}
            keyboardType="decimal-pad"
            unit={serving.label}
            autoFocus
            testID="serving-value-input"
          />
          <PrimaryButton label={t('foodDetail.done')} onPress={applyNumeric} fullWidth />
        </View>
      </BottomSheet>
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
