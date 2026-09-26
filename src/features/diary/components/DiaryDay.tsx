import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, StyleSheet, View } from 'react-native';

import type { DiaryDay as DiaryDayModel, DiaryMeal } from '@/data/db/repositories/diaryRepository';
import type { EnergyUnit } from '@/domain/units/units';
import { AppText, InlineStatus, PrimaryButton, TextAction } from '@/shared/components';
import type { LocalDate } from '@/shared/dates';
import { routes } from '@/shared/navigation/routes';
import { useTheme } from '@/shared/theme';

import { useAppSettings, useDiaryDay } from '../diary.queries';
import { CalorieRing } from './CalorieRing';
import { DiaryEntryRow, QuickCaloriesRow } from './DiaryEntryRow';
import { MacroStrip } from './MacroStrip';
import { MealHeader } from './MealHeader';

export type DiaryDayProps = {
  date: LocalDate;
  /** The selected page. Inactive (pre-rendered) pages jump back to the top, so a new day opens there (UX-02). */
  active: boolean;
  /** Bumped when the Diary tab is tapped at the root; the active page scrolls to the top (NAV-02). */
  scrollToTop?: number;
};

/** One diary day: overview (ring + macros), the default-goals row, and every meal in saved order (UX-02). */
export function DiaryDay({ date, active, scrollToTop = 0 }: DiaryDayProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const day = useDiaryDay(date);
  const settings = useAppSettings();
  const list = useRef<FlatList<DiaryMeal>>(null);

  useEffect(() => {
    if (!active) list.current?.scrollToOffset({ offset: 0, animated: false });
  }, [active]);

  useEffect(() => {
    if (active && scrollToTop > 0) list.current?.scrollToOffset({ offset: 0, animated: true });
    // Only a new tap scrolls; becoming active is handled above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollToTop]);

  if (day.isError || settings.isError) {
    // UX-02: a DB load failure is full-screen with Retry (never an offline banner).
    return (
      <View style={[styles.center, { padding: theme.spacing[4], gap: theme.spacing[4] }]} testID="diary-load-error">
        <AppText variant="sectionTitle" align="center">
          {t('diary.loadError.title')}
        </AppText>
        <PrimaryButton
          label={t('diary.loadError.retry')}
          onPress={() => {
            void day.refetch();
            void settings.refetch();
          }}
        />
      </View>
    );
  }
  // UX-00: local screens render directly; SQLite answers well under the 300 ms skeleton threshold.
  if (!day.data || !settings.data) return null;

  const unit = settings.data.energyUnit;
  const provisional = settings.data.goalsConfirmedAt === null;
  return (
    <FlatList
      ref={list}
      testID={active ? 'diary-day-list' : undefined}
      data={day.data.meals}
      keyExtractor={(meal) => meal.meal.id}
      ListHeaderComponent={<Overview day={day.data} unit={unit} provisional={provisional} />}
      renderItem={({ item }) => <MealSection meal={item} unit={unit} date={date} />}
      contentContainerStyle={{ paddingBottom: theme.spacing[6], backgroundColor: theme.colors.surface }}
      style={{ backgroundColor: theme.colors.canvas }}
      keyboardDismissMode="on-drag"
    />
  );
}

function Overview({ day, unit, provisional }: { day: DiaryDayModel; unit: EnergyUnit; provisional: boolean }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const goal = day.goal;
  return (
    <View style={{ backgroundColor: theme.colors.surface }}>
      <View
        style={[
          styles.overview,
          { paddingHorizontal: theme.spacing[4], paddingTop: theme.spacing[3], paddingBottom: theme.spacing[3] },
          { gap: theme.spacing[3] },
        ]}
      >
        <CalorieRing eatenKcal={day.totals.energyKcal} goalKcal={goal?.calorieTargetKcal ?? null} unit={unit} />
        <MacroStrip
          totals={day.totals}
          targets={
            goal
              ? { carbohydrateG: goal.carbohydrateTargetG, proteinG: goal.proteinTargetG, fatG: goal.fatTargetG }
              : null
          }
        />
      </View>
      {provisional ? (
        // UX-01: shown while goals are provisional; no dismiss. `Set goals` → Calories & Macros arrives with M8.
        <View style={{ paddingHorizontal: theme.spacing[4], paddingBottom: theme.spacing[3] }}>
          <InlineStatus tone="info" message={t('diary.defaultGoals.message')} testID="diary-default-goals" />
        </View>
      ) : null}
    </View>
  );
}

function MealSection({ meal, unit, date }: { meal: DiaryMeal; unit: EnergyUnit; date: LocalDate }) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <View testID={`diary-meal-${meal.meal.id}`}>
      <MealHeader name={meal.meal.name} energyKcal={meal.totals.energyKcal} unit={unit} />
      {meal.entries.map((entry) => {
        switch (entry.kind) {
          case 'food':
            return (
              <DiaryEntryRow
                key={entry.id}
                entry={entry}
                unit={unit}
                onPress={() => router.push(routes.editFoodEntry({ entryId: entry.id, origin: 'diary' }))}
              />
            );
          case 'quick_calories':
            return (
              <QuickCaloriesRow
                key={entry.id}
                entry={entry}
                unit={unit}
                // UX-02: row tap → the matching edit screen; it returns here (NAV-04).
                onPress={() => router.push(routes.editQuickCalories({ entryId: entry.id, origin: 'diary' }))}
              />
            );
        }
      })}
      {/* DS-08 Add Food row (42–44): the last row per meal. */}
      <View
        style={{
          minHeight: theme.sizes.addFoodRow[1],
          paddingHorizontal: theme.spacing[2],
          justifyContent: 'center',
        }}
      >
        <TextAction
          icon="add"
          label={t('diary.meal.addFood')}
          accessibilityHint={t('diary.meal.addFoodTo', { meal: meal.meal.name })}
          onPress={() => router.push(routes.foodSearch({ mealId: meal.meal.id, date }))}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  overview: { alignItems: 'center' },
});
