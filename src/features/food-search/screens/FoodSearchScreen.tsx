import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PanResponder, ScrollView, TextInput, View } from 'react-native';

import type { Food } from '@/data/db/repositories/foodsRepository';
import { useAppSettings, useMeals } from '@/features/diary/diary.queries';
import { AppBar, AppText, InlineStatus, PressableIcon, SectionHeader, TextAction } from '@/shared/components';
import type { LocalDate } from '@/shared/dates';
import { formatEnergy, formatShortDate, relativeDay } from '@/shared/i18n/format';
import { useFormattingLocale } from '@/shared/i18n/useFormattingLocale';
import { FocusablePressable } from '@/shared/components/FocusablePressable';
import { useTheme } from '@/shared/theme';

import { useCustomFoodSearch, useLocalFoodWrites, useRecentFoods, useSavedFoodSearch } from '../food-search.queries';

const LOCAL_DEBOUNCE_MS = 150;
const DELETE_REVEAL_WIDTH = 88;

export const shouldRevealFoodDelete = (dx: number) => dx <= -40;

type Props = {
  mealId: string;
  date: LocalDate;
  today: LocalDate;
  initialQuery?: string;
  onBack: () => void;
  onQuickCalories: () => void;
  onCreateCustom: (initialName: string) => void;
  onSelectFood: (food: Food) => void;
};

/** UX-04 M4 subset: focused search, Recents without a query, and local custom-food results after 150 ms. */
export function FoodSearchScreen({
  mealId,
  date,
  today,
  initialQuery = '',
  onBack,
  onQuickCalories,
  onCreateCustom,
  onSelectFood,
}: Props) {
  const { t } = useTranslation();
  const locale = useFormattingLocale();
  const theme = useTheme();
  const meals = useMeals();
  const settings = useAppSettings();
  const recents = useRecentFoods();
  const writes = useLocalFoodWrites();
  const [deleteFailed, setDeleteFailed] = useState(false);
  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery.trim());
  useEffect(() => {
    if (query.trim() === debouncedQuery) return;
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), LOCAL_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [debouncedQuery, query]);
  const custom = useCustomFoodSearch(debouncedQuery);
  const saved = useSavedFoodSearch(debouncedQuery);
  const meal = meals.data?.find((candidate) => candidate.id === mealId);
  if (!meal || !settings.data) return null;
  const relative = relativeDay(date, today);
  const dateLabel = relative ? t(`diary.${relative}`) : formatShortDate(date, today, locale);
  const hasQuery = query.trim().length > 0;
  const searching = hasQuery && query.trim() !== debouncedQuery;
  const customFoods = custom.data ?? [];
  const savedFoods = saved.data ?? [];
  const deleteFood = async (foodId: string) => {
    setDeleteFailed(false);
    try {
      await writes.deleteCustom.mutateAsync(foodId);
    } catch {
      setDeleteFailed(true);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.canvas }}>
      <AppBar
        title={t('foodSearch.title')}
        back={{ label: t('common.back'), onPress: onBack }}
        bottom={
          <View style={{ paddingHorizontal: theme.spacing[3], paddingBottom: theme.spacing[2] }}>
            <View
              style={{
                minHeight: 48,
                flexDirection: 'row',
                alignItems: 'center',
                borderRadius: theme.radii.medium,
                backgroundColor: theme.colors.surface,
                paddingLeft: theme.spacing[3],
              }}
            >
              <AppText accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                🔍
              </AppText>
              <TextInput
                autoFocus
                value={query}
                onChangeText={setQuery}
                placeholder={t('foodSearch.placeholder')}
                placeholderTextColor={theme.colors.textSecondary}
                accessibilityLabel={t('foodSearch.searchLabel')}
                testID="food-search-input"
                returnKeyType="search"
                autoCapitalize="none"
                style={{
                  flex: 1,
                  minHeight: 48,
                  paddingHorizontal: theme.spacing[2],
                  color: theme.colors.textPrimary,
                  fontSize: theme.typography.body.fontSize,
                }}
              />
              {query ? (
                <PressableIcon
                  icon="close"
                  accessibilityLabel={t('foodSearch.clear')}
                  onPress={() => setQuery('')}
                  color="textSecondary"
                  testID="food-search-clear"
                />
              ) : null}
            </View>
          </View>
        }
      />
      <ScrollView keyboardDismissMode="on-drag" contentContainerStyle={{ paddingBottom: theme.spacing[6] }}>
        <AppText
          variant="compact"
          color="textSecondary"
          style={{ paddingHorizontal: theme.spacing[4], paddingTop: theme.spacing[3] }}
        >
          {t('foodSearch.context', { meal: meal.name, date: dateLabel })}
        </AppText>
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: theme.spacing[3],
            paddingHorizontal: theme.spacing[4],
            paddingTop: theme.spacing[3],
          }}
        >
          <TextAction icon="flash-outline" label={t('foodSearch.quickCalories')} onPress={onQuickCalories} />
          <TextAction icon="add" label={t('foodSearch.createCustom')} onPress={() => onCreateCustom(query.trim())} />
        </View>
        {deleteFailed ? (
          <View style={{ paddingHorizontal: theme.spacing[4], paddingTop: theme.spacing[3] }}>
            <InlineStatus tone="error" message={t('foodSearch.deleteError')} />
          </View>
        ) : null}
        {hasQuery ? (
          <>
            {searching ? (
              <AppText color="textSecondary" style={{ paddingHorizontal: theme.spacing[4] }}>
                {t('foodSearch.searching')}
              </AppText>
            ) : (
              <>
                {customFoods.length > 0 ? <SectionHeader label={t('foodSearch.myFoods')} uppercase /> : null}
                {customFoods.map((food) => (
                <FoodResultRow
                  key={food.id}
                  food={food}
                  locale={locale}
                  energyUnit={settings.data.energyUnit}
                  onPress={() => onSelectFood(food)}
                  onDelete={food.source === 'custom' ? () => void deleteFood(food.id) : undefined}
                />
                ))}
                {savedFoods.length > 0 ? <SectionHeader label={t('foodSearch.saved')} uppercase /> : null}
                {savedFoods.map((food) => (
                  <FoodResultRow key={food.id} food={food} locale={locale} energyUnit={settings.data.energyUnit} onPress={() => onSelectFood(food)} />
                ))}
                {customFoods.length === 0 && savedFoods.length === 0 ? (
              <View style={{ paddingHorizontal: theme.spacing[4], gap: theme.spacing[2] }}>
                <AppText>{t('foodSearch.noResults', { query: query.trim() })}</AppText>
                <TextAction
                  icon="add"
                  label={t('foodSearch.createCustom')}
                  onPress={() => onCreateCustom(query.trim())}
                  testID="food-create-custom"
                />
              </View>
                ) : null}
              </>
            )}
          </>
        ) : (
          <>
            <SectionHeader label={t('foodSearch.recent')} uppercase />
            {(recents.data ?? []).length > 0 ? (
              recents.data!.map(({ food }) => (
                <FoodResultRow
                  key={food.id}
                  food={food}
                  locale={locale}
                  energyUnit={settings.data.energyUnit}
                  onPress={() => onSelectFood(food)}
                  onDelete={food.source === 'custom' ? () => void deleteFood(food.id) : undefined}
                />
              ))
            ) : (
              <AppText color="textSecondary" style={{ paddingHorizontal: theme.spacing[4] }}>
                {t('foodSearch.emptyRecent')}
              </AppText>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function FoodResultRow({
  food,
  locale,
  energyUnit,
  onPress,
  onDelete,
}: {
  food: Food;
  locale: string;
  energyUnit: 'kcal' | 'kJ';
  onPress: () => void;
  onDelete?: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const basis = food.brand || t('foodSearch.perBasis', { quantity: food.basisQuantity, unit: food.basisUnit });
  const energy = t('foodSearch.energy', {
    value: formatEnergy(food.nutrients.energyKcal, energyUnit, locale),
    unit: t(`diary.units.${energyUnit}`),
  });
  const energyValue = formatEnergy(food.nutrients.energyKcal, energyUnit, locale);
  const energyUnitLabel = t(`diary.units.${energyUnit}`);
  const [revealed, setRevealed] = useState(false);
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) => Boolean(onDelete) && gesture.dx < -10,
        onPanResponderRelease: (_event, gesture) => setRevealed(shouldRevealFoodDelete(gesture.dx)),
        onPanResponderTerminate: () => setRevealed(false),
      }),
    [onDelete],
  );
  return (
    <View style={{ overflow: 'hidden', backgroundColor: theme.colors.danger }}>
      <View
        {...pan.panHandlers}
        testID={`food-swipe-${food.id}`}
        pointerEvents={revealed ? 'none' : 'auto'}
        style={{ transform: [{ translateX: revealed ? -DELETE_REVEAL_WIDTH : 0 }] }}
      >
        <FocusablePressable
          accessibilityRole="button"
          accessibilityLabel={`${food.name}, ${basis}, ${energy}`}
          accessibilityActions={onDelete ? [{ name: 'delete', label: t('foodSearch.deleteFood') }] : undefined}
          onAccessibilityAction={(event) => {
            if (event.nativeEvent.actionName === 'delete') onDelete?.();
          }}
          onPress={() => {
            if (revealed) setRevealed(false);
            else onPress();
          }}
          testID={`food-result-${food.id}`}
          style={({ pressed }) => ({
            minHeight: 60,
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing[3],
            paddingHorizontal: theme.spacing[4],
            paddingVertical: theme.spacing[2],
            backgroundColor: pressed ? theme.colors.primaryTint : theme.colors.surface,
          })}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <AppText numberOfLines={1}>{food.name}</AppText>
            <AppText variant="compact" color="textSecondary" numberOfLines={1}>
              {basis} · {t('foodSearch.customSource')}
            </AppText>
          </View>
          <View style={{ width: 64, flexShrink: 0, alignItems: 'flex-end', marginLeft: theme.spacing[2] }}>
            <AppText variant="compact" numberOfLines={1} tabular align="right">
              {energyValue}
            </AppText>
            <AppText variant="compact" numberOfLines={1} align="right">
              {energyUnitLabel}
            </AppText>
          </View>
        </FocusablePressable>
      </View>
      {onDelete ? (
        <FocusablePressable
          accessibilityRole="button"
          accessibilityLabel={t('foodSearch.delete')}
          accessible={revealed}
          accessibilityElementsHidden={!revealed}
          importantForAccessibility={revealed ? 'auto' : 'no-hide-descendants'}
          onPress={onDelete}
          testID={`food-delete-${food.id}`}
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            width: DELETE_REVEAL_WIDTH,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <AppText variant="compactStrong" color="onPrimary">
            {t('foodSearch.delete')}
          </AppText>
        </FocusablePressable>
      ) : null}
    </View>
  );
}
