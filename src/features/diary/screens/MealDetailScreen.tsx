import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import type { DiaryMeal } from '@/data/db/repositories/diaryRepository';
import type { EnergyUnit } from '@/domain/units/units';
import { AppBar, AppText, NotFoundState, PressableIcon, PrimaryButton, TextAction } from '@/shared/components';
import type { LocalDate } from '@/shared/dates';
import { formatEnergy, formatLongDate } from '@/shared/i18n/format';
import { useFormattingLocale } from '@/shared/i18n/useFormattingLocale';
import { routes, type RouteParams } from '@/shared/navigation/routes';
import { useTheme } from '@/shared/theme';

import { MealEntries } from '../components/DiaryEntryRow';
import { useAppSettings, useDiaryMeal } from '../diary.queries';
import { useDiaryDate } from '../hooks/DiaryDateContext';

/** UX-00 not found → the Diary stack root. */
const toDiaryRoot = () => router.dismissTo(routes.diary());

/**
 * Meal Detail (UX-03, NAV-04): one meal on one date, identified by `mealId` (never by name). `params` is `null`
 * when the route params were invalid. A meal deleted elsewhere shows Not found (UX-00). Back → Diary, same date.
 */
export function MealDetailScreen({ params }: { params: RouteParams['mealDetail'] | null }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const meal = useDiaryMeal(params?.date ?? '', params?.mealId ?? '', params !== null);
  const settings = useAppSettings();
  // T3 (UX-12) renders the Copy Meal Sheet from this state.
  const [, setCopying] = useState(false);

  const back = { label: t('common.back'), onPress: () => router.back() };
  const addFood = params
    ? () => router.push(routes.foodSearch({ mealId: params.mealId, date: params.date, origin: 'mealDetail' }))
    : undefined;

  let title = '';
  let body: React.ReactNode = null;
  if (!params || meal.data === null) {
    body = <NotFoundState actionLabel={t('common.backToDiary')} onAction={toDiaryRoot} />;
  } else if (meal.isError || settings.isError) {
    body = (
      <View style={[styles.center, { padding: theme.spacing[4], gap: theme.spacing[4] }]}>
        <AppText variant="sectionTitle" align="center">
          {t('diary.loadError.title')}
        </AppText>
        <PrimaryButton
          label={t('diary.loadError.retry')}
          onPress={() => {
            void meal.refetch();
            void settings.refetch();
          }}
        />
      </View>
    );
  } else if (meal.data && settings.data) {
    title = meal.data.meal.name;
    body = (
      <MealContent
        meal={meal.data}
        date={params.date}
        unit={settings.data.energyUnit}
        onAddFood={addFood!}
        onCopy={() => setCopying(true)}
      />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface }} testID="meal-detail">
      <AppBar
        title={title}
        back={back}
        actions={
          title && addFood ? (
            <PressableIcon
              icon="add"
              accessibilityLabel={t('diary.meal.addFoodTo', { meal: title })}
              onPress={addFood}
              color="onAppBar"
            />
          ) : undefined
        }
      />
      {body}
    </View>
  );
}

function MealContent({
  meal,
  date,
  unit,
  onAddFood,
  onCopy,
}: {
  meal: DiaryMeal;
  date: LocalDate;
  unit: EnergyUnit;
  onAddFood: () => void;
  onCopy: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const locale = useFormattingLocale();
  const { today } = useDiaryDate();
  const value = formatEnergy(meal.totals.energyKcal, unit, locale);
  const empty = meal.entries.length === 0;
  return (
    <ScrollView contentContainerStyle={{ paddingBottom: theme.spacing[6] }}>
      {/* DS-09: compact header (date + one Copy meal text action, then marker + kcal); no hero area. */}
      <View
        style={[
          styles.row,
          { paddingLeft: theme.spacing[4], paddingRight: theme.spacing[2], paddingTop: theme.spacing[2] },
        ]}
      >
        <AppText variant="body" color="textSecondary" style={styles.grow}>
          {formatLongDate(date, today, locale)}
        </AppText>
        <TextAction
          icon="copy-outline"
          label={t('mealDetail.copyMeal')}
          onPress={onCopy}
          disabled={empty}
          testID="meal-detail-copy"
        />
      </View>
      <View
        accessible
        accessibilityLabel={t('mealDetail.totalA11y', { value, unit: t(`diary.units.${unit}Spoken`) })}
        style={[
          styles.row,
          {
            gap: theme.spacing[2],
            paddingHorizontal: theme.spacing[4],
            paddingBottom: theme.spacing[3],
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: theme.colors.divider,
          },
        ]}
      >
        <View
          style={[
            styles.marker,
            { borderColor: theme.colors.borderStrong, width: theme.spacing[3], height: theme.spacing[3] },
          ]}
        />
        <AppText variant="sectionTitle" tabular>
          {t('diary.meal.energy', { value, unit: t(`diary.units.${unit}`) })}
        </AppText>
      </View>
      {empty ? (
        <AppText
          variant="body"
          color="textSecondary"
          style={{ paddingHorizontal: theme.spacing[4], paddingTop: theme.spacing[4], paddingBottom: theme.spacing[2] }}
        >
          {t('mealDetail.empty')}
        </AppText>
      ) : (
        <MealEntries entries={meal.entries} unit={unit} origin="mealDetail" />
      )}
      {/* DS-08 Add Food row: the last row. */}
      <View
        style={{ minHeight: theme.sizes.addFoodRow[1], paddingHorizontal: theme.spacing[2], justifyContent: 'center' }}
      >
        <TextAction
          icon="add"
          label={t('mealDetail.addFood')}
          accessibilityHint={t('diary.meal.addFoodTo', { meal: meal.meal.name })}
          onPress={onAddFood}
          testID="meal-detail-add-food"
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  grow: { flex: 1 },
  marker: { borderWidth: 1.5, borderRadius: 999 },
});
