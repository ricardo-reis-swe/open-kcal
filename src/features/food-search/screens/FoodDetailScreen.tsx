import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  HeaderAction,
  InlineStatus,
  ListRow,
  NotFoundState,
  TextAction,
} from '@/shared/components';
import { formatEnergy, formatGrams, formatShortDate, relativeDay } from '@/shared/i18n/format';
import { useFormattingLocale } from '@/shared/i18n/useFormattingLocale';
import { MealPicker } from '@/shared/navigation/MealPicker';
import { routes, type FoodSource, type Origin } from '@/shared/navigation/routes';
import { useTheme } from '@/shared/theme';

import { announceAddedFood } from '../addedNotice';
import { ServingRuler } from '../components/ServingRuler';
import { useExternalFood, useFood, useRecentFood } from '../food-search.queries';

export type FoodDetailMode =
  | {
      kind: 'add';
      foodId: string;
      foodSource: FoodSource;
      externalId?: string;
      mealId: string;
      date: string;
      origin: Origin;
    }
  | { kind: 'edit'; entryId: string; origin: Origin }
  | null;

/** UX-05/06 add and edit. Edit falls back to the entry snapshot when its source food/serving cannot resolve. */
export function FoodDetailScreen({ mode }: { mode: FoodDetailMode }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const editing = mode?.kind === 'edit';
  const entry = useDiaryEntry(editing ? mode.entryId : '', editing);
  const foodId = mode?.kind === 'add' ? mode.foodId : (entry.data?.foodId ?? '');
  const externalId = mode?.kind === 'add' ? mode.externalId : undefined;
  const storedFood = useFood(foodId, Boolean(foodId) && !externalId);
  const externalFood = useExternalFood(
    mode?.kind === 'add' && mode.foodSource !== 'custom' ? mode.foodSource : 'usda',
    externalId ?? '',
    Boolean(externalId),
  );
  const food = externalId ? externalFood : storedFood;
  const recent = useRecentFood(foodId, Boolean(foodId));
  const meals = useMeals();
  const settings = useAppSettings();
  const notFound = (
    <NotFoundState actionLabel={t('common.backToDiary')} onAction={() => router.dismissTo(routes.diary())} />
  );
  let body: React.ReactNode = null;
  let formRendered = false;

  if (!mode || (editing && entry.data && entry.data.kind !== 'food')) body = notFound;
  else if (mode.kind === 'add' && food.data && (food.data.isDeleted || food.data.source !== mode.foodSource)) {
    body = notFound;
  } else if (
    mode.kind === 'add' &&
    food.data &&
    recent.isSuccess &&
    !recent.isFetching &&
    meals.data &&
    settings.data
  ) {
    // Wait for the direct lookup to settle. A cached old record (including a prior `null`) must not initialize the
    // form before its on-mount refresh returns the serving just saved for this food.
    const selected = initialServing(
      food.data.servings,
      recent.data ? { servingId: recent.data.lastServingId, quantity: recent.data.lastServingQuantity } : null,
    );
    const initial = selected
      ? { serving: food.data.servings.find((item) => item.id === selected.serving.id)!, quantity: selected.quantity }
      : null;
    if (!initial || !meals.data.some((meal) => meal.id === mode.mealId)) body = notFound;
    else {
      formRendered = true;
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
    formRendered = true;
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
    (entry.isError || meals.isError || settings.isError || (mode?.kind === 'add' && (food.isError || recent.isError)))
  )
    body = notFound;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.canvas }}>
      {formRendered ? (
        body
      ) : body ? (
        <>
          <AppBar
            title={t(editing ? 'foodDetail.editTitle' : 'foodDetail.title')}
            back={{ label: t('common.back'), onPress: () => router.back() }}
          />
          {body}
        </>
      ) : null}
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
  const chooseServing = (next: FoodServing) => {
    setQuantity(convertServingQuantity(quantity, serving, next));
    setServing(next);
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
        // NAV-04: an add returns to Food Search (query and results intact) to log the next food; the Diary is
        // already on the target date for when the user leaves search.
        announceAddedFood(food.name, mealName);
        router.back();
      } else {
        await writes.editFoodEntry.mutateAsync({
          id: mode.entryId,
          mealId,
          quantity,
          ...(allowServingChange ? { servingId: serving.id } : {}),
        });
        router.back();
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
    if (!numericValueValid) return;
    setQuantity(parsed);
    setEditingValue(false);
  };
  const numericValueValid =
    Number(valueText.trim().replace(',', '.')) > 0 &&
    Number.isFinite(Number(valueText.trim().replace(',', '.'))) &&
    /^\d+(?:[.,]\d{1,2})?$/.test(valueText.trim());

  return (
    <>
      <AppBar
        title={t(mode.kind === 'edit' ? 'foodDetail.editTitle' : 'foodDetail.title')}
        back={{ label: t('common.back'), onPress: () => router.back() }}
        actions={
          <HeaderAction
            label={mode.kind === 'add' ? t('common.add') : t('foodDetail.save')}
            onPress={() => void save()}
            loading={writes.addFoodEntry.isPending || writes.editFoodEntry.isPending}
            disabled={writes.addFoodEntry.isPending || writes.editFoodEntry.isPending}
            testID={mode.kind === 'add' ? 'food-detail-add' : 'food-entry-save'}
          />
        }
      />
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
          {allowServingChange ? (
            <ServingUnitTabs servings={orderedServings} selected={serving} onSelect={chooseServing} />
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
          {saveFailed || deleteFailed ? (
            <View style={{ paddingHorizontal: theme.spacing[4], gap: theme.spacing[2] }}>
              {saveFailed ? <InlineStatus tone="error" message={t('foodDetail.saveError')} /> : null}
              {deleteFailed ? <InlineStatus tone="error" message={t('foodDetail.deleteError')} /> : null}
            </View>
          ) : null}
        </ScrollView>
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
        visible={editingValue}
        onClose={() => setEditingValue(false)}
        accessibilityLabel={t('foodDetail.enterServing')}
        closeLabel={t('common.close')}
        // UX screens rule: the primary action (Done) stays above the keypad, never behind it (iOS decimal pad).
        avoidKeyboard
        testID="serving-value-sheet"
      >
        <View style={{ paddingHorizontal: theme.spacing[4], paddingBottom: theme.spacing[4], gap: theme.spacing[3] }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: -theme.spacing[3] }}>
            <AppText variant="bodyStrong" accessibilityRole="header" numberOfLines={1} style={{ flex: 1 }}>
              {t('foodDetail.enterServing')}
            </AppText>
            <HeaderAction
              label={t('foodDetail.done')}
              onPress={applyNumeric}
              disabled={!numericValueValid}
              placement="surface"
              testID="serving-value-confirm"
            />
          </View>
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

function ServingUnitTabs({
  servings,
  selected,
  onSelect,
}: {
  servings: readonly FoodServing[];
  selected: FoodServing;
  onSelect: (serving: FoodServing) => void;
}) {
  const theme = useTheme();
  const scroll = useRef<ScrollView>(null);
  const layouts = useRef<Record<string, { x: number; width: number }>>({});
  const hasCentered = useRef(false);
  const [viewportWidth, setViewportWidth] = useState(0);
  const centerSelected = useCallback(
    (animated: boolean) => {
      const layout = layouts.current[selected.id];
      if (!layout || viewportWidth === 0) return;
      scroll.current?.scrollTo({ x: Math.max(0, layout.x + layout.width / 2 - viewportWidth / 2), animated });
    },
    [selected.id, viewportWidth],
  );

  useEffect(() => {
    centerSelected(hasCentered.current);
    hasCentered.current = true;
  }, [centerSelected]);

  return (
    <ScrollView
      ref={scroll}
      horizontal
      showsHorizontalScrollIndicator={false}
      onLayout={(event) => setViewportWidth(event.nativeEvent.layout.width)}
      // Opening an existing entry can measure its saved unit after the initial effect; center again once the scroll
      // range exists so the first selected unit is not left off-center.
      onContentSizeChange={() => centerSelected(false)}
      contentContainerStyle={{
        paddingHorizontal: Math.max(theme.spacing[4], viewportWidth / 2),
        gap: theme.spacing[3],
      }}
    >
      {servings.map((unit) => (
        <View
          key={unit.id}
          onLayout={(event) => {
            layouts.current[unit.id] = event.nativeEvent.layout;
            if (unit.id === selected.id) centerSelected(false);
          }}
        >
          <TextAction label={unit.label} onPress={() => onSelect(unit)} selected={unit.id === selected.id} />
        </View>
      ))}
    </ScrollView>
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
