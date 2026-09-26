import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, TextInput, View } from 'react-native';

import type { Food } from '@/data/db/repositories/foodsRepository';
import { useAppSettings, useMeals } from '@/features/diary/diary.queries';
import { AppBar, AppText, PressableIcon, SectionHeader, TextAction } from '@/shared/components';
import type { LocalDate } from '@/shared/dates';
import { formatEnergy, formatShortDate, relativeDay } from '@/shared/i18n/format';
import { useFormattingLocale } from '@/shared/i18n/useFormattingLocale';
import { FocusablePressable } from '@/shared/components/FocusablePressable';
import { useTheme } from '@/shared/theme';

import { useCustomFoodSearch, useRecentFoods } from '../food-search.queries';

const LOCAL_DEBOUNCE_MS = 150;

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
  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery.trim());
  useEffect(() => {
    if (query.trim() === debouncedQuery) return;
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), LOCAL_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [debouncedQuery, query]);
  const custom = useCustomFoodSearch(debouncedQuery);
  const meal = meals.data?.find((candidate) => candidate.id === mealId);
  if (!meal || !settings.data) return null;
  const relative = relativeDay(date, today);
  const dateLabel = relative ? t(`diary.${relative}`) : formatShortDate(date, today, locale);
  const hasQuery = query.trim().length > 0;
  const searching = hasQuery && query.trim() !== debouncedQuery;
  const customFoods = custom.data ?? [];

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
        {hasQuery ? (
          <>
            <SectionHeader label={t('foodSearch.myFoods')} uppercase />
            {searching ? (
              <AppText color="textSecondary" style={{ paddingHorizontal: theme.spacing[4] }}>
                {t('foodSearch.searching')}
              </AppText>
            ) : customFoods.length > 0 ? (
              customFoods.map((food) => (
                <FoodResultRow
                  key={food.id}
                  food={food}
                  locale={locale}
                  energyUnit={settings.data.energyUnit}
                  onPress={() => onSelectFood(food)}
                />
              ))
            ) : (
              <View style={{ paddingHorizontal: theme.spacing[4], gap: theme.spacing[2] }}>
                <AppText>{t('foodSearch.noResults', { query: query.trim() })}</AppText>
                <TextAction
                  icon="add"
                  label={t('foodSearch.createCustom')}
                  onPress={() => onCreateCustom(query.trim())}
                />
              </View>
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
}: {
  food: Food;
  locale: string;
  energyUnit: 'kcal' | 'kJ';
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const basis = food.brand || t('foodSearch.perBasis', { quantity: food.basisQuantity, unit: food.basisUnit });
  const energy = t('foodSearch.energy', {
    value: formatEnergy(food.nutrients.energyKcal, energyUnit, locale),
    unit: t(`diary.units.${energyUnit}`),
  });
  return (
    <FocusablePressable
      accessibilityRole="button"
      accessibilityLabel={`${food.name}, ${basis}, ${energy}`}
      onPress={onPress}
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
      <View style={{ flex: 1 }}>
        <AppText numberOfLines={1}>{food.name}</AppText>
        <AppText variant="compact" color="textSecondary" numberOfLines={1}>
          {basis} · {t('foodSearch.customSource')}
        </AppText>
      </View>
      <AppText variant="compact" tabular>
        {energy}
      </AppText>
    </FocusablePressable>
  );
}
