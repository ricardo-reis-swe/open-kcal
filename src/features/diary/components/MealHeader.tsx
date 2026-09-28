import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import type { EnergyUnit } from '@/domain/units/units';
import { AppText, PressableIcon } from '@/shared/components';
import { formatEnergy } from '@/shared/i18n/format';
import { useFormattingLocale } from '@/shared/i18n/useFormattingLocale';
import { useTheme } from '@/shared/theme';

export type MealHeaderProps = {
  name: string;
  energyKcal: number;
  unit: EnergyUnit;
  /** Header `+` → Food Search (UX-02). */
  onAdd?: () => void;
  /** Header overflow menu → meal actions. */
  onMenu?: () => void;
};

/**
 * DS-08 meal header (44): the user's meal name (never auto-uppercased, DS-04), kcal right-aligned, overflow menu,
 * and compact add action. A subtle tint, not a card; long names truncate before kcal/actions lose space.
 */
export function MealHeader({ name, energyKcal, unit, onAdd, onMenu }: MealHeaderProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const locale = useFormattingLocale();
  const value = formatEnergy(energyKcal, unit, locale);
  return (
    <View
      style={[
        styles.row,
        {
          minHeight: theme.sizes.mealHeader,
          paddingLeft: theme.spacing[4],
          paddingRight: theme.spacing[1],
          gap: theme.spacing[2],
          backgroundColor: theme.colors.surfaceSubtle,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderColor: theme.colors.divider,
        },
      ]}
    >
      <View
        accessible
        accessibilityRole="header"
        accessibilityLabel={t('diary.meal.a11y', { meal: name, value, unit: t(`diary.units.${unit}Spoken`) })}
        style={[styles.row, styles.grow, { gap: theme.spacing[2], minHeight: theme.sizes.mealHeader }]}
      >
        <AppText variant="bodyStrong" numberOfLines={1} style={styles.grow}>
          {name}
        </AppText>
        <AppText variant="compact" color="textSecondary" tabular>
          {t('diary.meal.energy', { value, unit: t(`diary.units.${unit}`) })}
        </AppText>
      </View>
      <PressableIcon
        icon="ellipsis-horizontal"
        accessibilityLabel={t('diary.meal.menu', { meal: name })}
        onPress={onMenu ?? noop}
        disabled={!onMenu}
        color="textSecondary"
        testID={`meal-menu-${name}`}
      />
      <PressableIcon
        icon="add"
        accessibilityLabel={t('diary.meal.addFoodTo', { meal: name })}
        onPress={onAdd ?? noop}
        disabled={!onAdd}
        color="primary"
      />
    </View>
  );
}

const noop = () => undefined;

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  grow: { flex: 1 },
});
