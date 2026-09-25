import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import type { MacroKey, NutrientTotals } from '@/domain/nutrition/nutrients';
import { AppIcon, AppText, ProgressTrack } from '@/shared/components';
import { formatGrams } from '@/shared/i18n/format';
import { useFormattingLocale } from '@/shared/i18n/useFormattingLocale';
import { useTheme, type Colors } from '@/shared/theme';

export type MacroTargets = Record<MacroKey, number>;

export type MacroStripProps = {
  totals: NutrientTotals;
  /** `null` when no goal applies to the date yet (DATA-09). */
  targets: MacroTargets | null;
};

// DS-03: fixed color + text label + fixed position (carbs, protein, fat).
const MACROS = [
  { key: 'carbohydrateG', label: 'diary.macros.carbs', unknown: 'diary.macros.unknownCarbs', color: 'macroCarbs' },
  { key: 'proteinG', label: 'diary.macros.protein', unknown: 'diary.macros.unknownProtein', color: 'macroProtein' },
  { key: 'fatG', label: 'diary.macros.fat', unknown: 'diary.macros.unknownFat', color: 'macroFat' },
] as const satisfies readonly { key: MacroKey; label: string; unknown: string; color: keyof Colors }[];

/**
 * DS-08 macro strip: one row, 3 columns (label, consumed/target, 4pt track). An info icon marks a partial total
 * when Quick Calories or incomplete foods have unknown values (DATA-06); the explanation is in the label (DS-11).
 */
export function MacroStrip({ totals, targets }: MacroStripProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const locale = useFormattingLocale();
  return (
    <View style={[styles.row, { gap: theme.spacing[3] }]} testID="macro-strip">
      {MACROS.map((macro) => {
        const total = totals[macro.key];
        const target = targets?.[macro.key] ?? null;
        const consumed = formatGrams(total.knownSum, locale);
        const partial = total.unknownCount > 0;
        const over = target !== null && total.knownSum > target;
        const name = t(macro.label);
        const value =
          target === null
            ? t('diary.macros.valueNoGoal', { consumed })
            : t('diary.macros.value', { consumed, target: formatGrams(target, locale) });
        const base =
          target === null
            ? t('diary.macros.a11yNoGoal', { macro: name, consumed })
            : t(over ? 'diary.macros.a11yOver' : 'diary.macros.a11y', {
                macro: name,
                consumed,
                target: formatGrams(target, locale),
              });
        return (
          <View
            key={macro.key}
            testID={`macro-${macro.key}`}
            accessible
            accessibilityRole="text"
            accessibilityLabel={partial ? `${base} ${t(macro.unknown)}` : base}
            style={styles.column}
          >
            <View style={[styles.labelRow, { gap: theme.spacing[1] }]}>
              <AppText variant="label" color="textSecondary" numberOfLines={1} style={styles.shrink}>
                {name}
              </AppText>
              {partial ? <AppIcon name="information-circle-outline" size="inline" color="textSecondary" /> : null}
            </View>
            <AppText variant="compactStrong" tabular color={over ? 'warning' : 'textPrimary'}>
              {value}
            </AppText>
            <View style={{ marginTop: theme.spacing[1] }}>
              <ProgressTrack progress={target ? total.knownSum / target : 0} color={macro.color} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap' },
  // DS-11: at large text the columns wrap instead of clipping.
  column: { flexGrow: 1, flexBasis: 88 },
  labelRow: { flexDirection: 'row', alignItems: 'center' },
  shrink: { flexShrink: 1 },
});
