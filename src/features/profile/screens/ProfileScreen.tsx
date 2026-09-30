import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { AppSettings } from '@/data/db/repositories/settingsRepository';
import { visibleDashboardNutrients } from '@/domain/nutrition/dashboardNutrients';
import { useAppSettings, useDashboardNutrients, useMeals } from '@/features/diary/diary.queries';
import {
  useCurrentGoal,
  useCurrentWeight,
  useThemePreference,
  useUsdaKeyConfigured,
} from '@/features/profile/profile.queries';
import { AppBar, AppText, ListRow, PrimaryButton, SectionHeader } from '@/shared/components';
import { formatEnergy, formatWeight } from '@/shared/i18n/format';
import { useFormattingLocale } from '@/shared/i18n/useFormattingLocale';
import { useTheme } from '@/shared/theme';

/**
 * NAV-06 destinations. A row only navigates (chevron + press) when its handler is wired, so a sub-screen that
 * doesn't exist yet is never reachable as a placeholder.
 */
export type ProfileNavigation = {
  onUpdateWeight?: () => void;
  onWeightHistory?: () => void;
  onCaloriesMacros?: () => void;
  onWeightGoal?: () => void;
  onMeals?: () => void;
  onUnits?: () => void;
  onDashboardNutrients?: () => void;
  onFoodDatabases?: () => void;
  onTheme?: () => void;
};

/** UX-15 Profile hub: weight summary, Update weight, and the settings rows with their current values (DS-09). */
export function ProfileScreen(nav: ProfileNavigation) {
  const { t } = useTranslation();
  const theme = useTheme();
  const locale = useFormattingLocale();
  const settings = useAppSettings().data;
  const goal = useCurrentGoal().data;
  const weight = useCurrentWeight();
  const meals = useMeals().data;
  const usda = useUsdaKeyConfigured().data;
  const dashboardNutrients = useDashboardNutrients().data;
  const themePreference = useThemePreference().data;
  const shownNutrients = dashboardNutrients ? visibleDashboardNutrients(dashboardNutrients).length : undefined;

  const unitLabel = (unit: string) => t(`units.${unit}` as 'units.kg');
  const withUnit = (value: string, unit: string) => t('profile.valueWithUnit', { value, unit: unitLabel(unit) });
  const weightText = (kg: number, s: AppSettings) => withUnit(formatWeight(kg, s.weightUnit, locale), s.weightUnit);

  const goalWeight = settings?.goalWeightKg != null ? weightText(settings.goalWeightKg, settings) : null;
  const calories =
    settings && goal
      ? withUnit(formatEnergy(goal.calorieTargetKcal, settings.energyUnit, locale), settings.energyUnit)
      : undefined;
  const units = settings
    ? [settings.weightUnit, settings.foodWeightUnit, settings.energyUnit, settings.volumeUnit]
        .map(unitLabel)
        .join(' · ')
    : undefined;

  const row = (label: string, value: string | undefined, onPress: (() => void) | undefined, testID: string) => (
    <ListRow label={label} value={value} navigates={!!onPress} onPress={onPress} testID={testID} />
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.canvas }}>
      <AppBar title={t('profile.title')} />
      <ScrollView contentContainerStyle={{ paddingBottom: theme.spacing[8] }}>
        <View
          style={{ backgroundColor: theme.colors.surface, padding: theme.spacing[4], gap: theme.spacing[4] }}
          testID="profile-weight-summary"
        >
          {weight.isSuccess && settings ? (
            <View style={[styles.summary, { gap: theme.spacing[4] }]}>
              {weight.data ? (
                <AppText variant="bodyStrong" tabular testID="profile-current-weight">
                  {`${t('profile.current')} ${weightText(weight.data.weightKg, settings)}`}
                </AppText>
              ) : (
                <AppText variant="body" color="textSecondary" testID="profile-current-weight">
                  {t('profile.noWeight')}
                </AppText>
              )}
              <AppText variant="body" color="textSecondary" tabular testID="profile-goal-weight">
                {`${t('profile.goal')} ${goalWeight ?? '—'}`}
              </AppText>
            </View>
          ) : null}
          {nav.onUpdateWeight ? (
            <PrimaryButton
              label={t('profile.updateWeight')}
              onPress={nav.onUpdateWeight}
              testID="profile-update-weight"
            />
          ) : null}
        </View>
        {row(t('profile.weightHistory'), undefined, nav.onWeightHistory, 'profile-weight-history')}

        <SectionHeader label={t('profile.goalsSection')} uppercase />
        {row(t('profile.caloriesMacros'), calories, nav.onCaloriesMacros, 'profile-calories-macros')}
        {row(t('profile.weightGoal'), goalWeight ?? '—', nav.onWeightGoal, 'profile-weight-goal')}

        <SectionHeader label={t('profile.diarySection')} uppercase />
        {row(
          t('profile.meals'),
          meals ? t('profile.mealCount', { count: meals.length }) : undefined,
          nav.onMeals,
          'profile-meals',
        )}
        {row(t('profile.units'), units, nav.onUnits, 'profile-units')}
        {row(
          t('profile.dashboardNutrients'),
          shownNutrients === undefined
            ? undefined
            : shownNutrients === 0
              ? t('profile.nutrientsNone')
              : t('profile.nutrientsShown', { count: shownNutrients }),
          nav.onDashboardNutrients,
          'profile-dashboard-nutrients',
        )}

        <SectionHeader label={t('profile.foodDataSection')} uppercase />
        {row(
          t('profile.foodDatabases'),
          usda === undefined ? undefined : t(usda ? 'profile.usdaOn' : 'profile.usdaOff'),
          nav.onFoodDatabases,
          'profile-food-databases',
        )}

        <SectionHeader label={t('profile.appSection')} uppercase />
        {row(
          t('profile.theme'),
          themePreference ? t(`theme.${themePreference}`) : undefined,
          nav.onTheme,
          'profile-theme',
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
});
