import { useTranslation } from 'react-i18next';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { catalogNutrient, type NutrientId } from '@/domain/nutrition/nutrientCatalog';
import { nutrientTotal, type NutrientTotals } from '@/domain/nutrition/nutrients';
import { AppText } from '@/shared/components';
import { useReducedMotion } from '@/shared/hooks/useReducedMotion';
import { formatNutrientAmount } from '@/shared/i18n/format';
import { useFormattingLocale } from '@/shared/i18n/useFormattingLocale';
import { useTheme } from '@/shared/theme';

const COLUMN_BASIS = 88;

/**
 * DS-08 nutrient panel (UX-02): the day's totals for the DATA-21 visible nutrients, in their set order. No tracks or
 * targets (SCOPE-10). A partial total (entries without a value) is explained in the accessible label, as the macros.
 */
export function NutrientPanel({ totals, ids }: { totals: NutrientTotals; ids: readonly NutrientId[] }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const locale = useFormattingLocale();
  const reducedMotion = useReducedMotion();
  const { fontScale } = useWindowDimensions();
  const basis = COLUMN_BASIS * Math.max(fontScale, 1);
  return (
    <Animated.View
      entering={reducedMotion ? undefined : FadeIn.duration(150)}
      exiting={reducedMotion ? undefined : FadeOut.duration(100)}
      style={[styles.grid, { gap: theme.spacing[3], paddingTop: theme.spacing[3] }]}
      testID="nutrient-panel"
    >
      {ids.map((id) => {
        const { unit, decimals } = catalogNutrient(id);
        const total = nutrientTotal(totals, id);
        const value = formatNutrientAmount(total.knownSum, decimals, locale);
        const name = t(`nutrients.names.${id}`);
        const base = t('diaryNutrients.a11y', { name, value, unit: t(`nutrients.unitsSpoken.${unit}`) });
        return (
          <View
            key={id}
            accessible
            accessibilityRole="text"
            accessibilityLabel={total.unknownCount > 0 ? `${base} ${t('diaryNutrients.partial')}` : base}
            testID={`nutrient-panel-${id}`}
            style={[styles.column, { flexBasis: basis }]}
          >
            <AppText variant="label" color="textSecondary" numberOfLines={1}>
              {name}
            </AppText>
            <AppText variant="compactStrong" tabular>
              {t('diaryNutrients.value', { value, unit })}
            </AppText>
          </View>
        );
      })}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  column: { flexGrow: 1 },
});
