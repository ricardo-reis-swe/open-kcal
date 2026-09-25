import { useTranslation } from 'react-i18next';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

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

const COLUMN_BASIS = 88;

/**
 * DS-08 macro strip: one row, 3 columns (label, consumed/target, 4pt track). An info icon marks a partial total
 * when Quick Calories or incomplete foods have unknown values (DATA-06); the explanation is in the label (DS-11).
 */
export function MacroStrip({ totals, targets }: MacroStripProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const locale = useFormattingLocale();
  // DS-11: the column basis grows with the text, so at large sizes the strip wraps/stacks instead of clipping.
  const { fontScale } = useWindowDimensions();
  const basis = COLUMN_BASIS * Math.max(fontScale, 1);
  return (
    <View style={[styles.row, { gap: theme.spacing[3] }]} testID="macro-strip">
      {MACROS.map((macro) => {
        const total = totals[macro.key];
        const target = targets?.[macro.key] ?? null;
        const partial = total.unknownCount > 0;
        // UX-00 / DATA-06: when no entry knows this macro, the total is unknown (`—`), never 0.
        const allUnknown = partial && total.unknownCount === totals.entryCount;
        const consumed = allUnknown ? t('diary.macros.unknownValue') : formatGrams(total.knownSum, locale);
        const over = !allUnknown && target !== null && total.knownSum > target;
        const name = t(macro.label);
        const targetText = target === null ? null : formatGrams(target, locale);
        const value =
          targetText === null
            ? t('diary.macros.valueNoGoal', { consumed })
            : t('diary.macros.value', { consumed, target: targetText });
        let base: string;
        if (allUnknown) {
          base =
            targetText === null
              ? t('diary.macros.a11yUnknownNoGoal', { macro: name })
              : t('diary.macros.a11yUnknown', { macro: name, target: targetText });
        } else if (targetText === null) {
          base = t('diary.macros.a11yNoGoal', { macro: name, consumed });
        } else {
          base = t(over ? 'diary.macros.a11yOver' : 'diary.macros.a11y', { macro: name, consumed, target: targetText });
        }
        const a11y =
          partial && !allUnknown ? t('diary.macros.a11yPartial', { text: base, note: t(macro.unknown) }) : base;
        return (
          <View
            key={macro.key}
            testID={`macro-${macro.key}`}
            accessible
            accessibilityRole="text"
            accessibilityLabel={a11y}
            style={[styles.column, { flexBasis: basis }]}
          >
            <View style={[styles.labelRow, { gap: theme.spacing[1] }]}>
              <AppText variant="label" color="textSecondary" style={styles.shrink}>
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
  column: { flexGrow: 1 },
  labelRow: { flexDirection: 'row', alignItems: 'center' },
  shrink: { flexShrink: 1 },
});
