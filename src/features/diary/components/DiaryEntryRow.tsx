import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import type { DiaryEntry } from '@/data/db/repositories/diaryRepository';
import type { EnergyUnit } from '@/domain/units/units';
import { AppIcon, AppText, FocusablePressable } from '@/shared/components';
import { formatEnergy } from '@/shared/i18n/format';
import { useFormattingLocale } from '@/shared/i18n/useFormattingLocale';
import { useTheme } from '@/shared/theme';

export type EntryRowProps = {
  entry: DiaryEntry;
  unit: EnergyUnit;
  /** Row tap → the matching edit screen (UX-02). Not pressable until those routes land (M3/M4). */
  onPress?: () => void;
};

// Serving labels that are measurement units read as `150 g`; anything else is a count: `2 × egg`.
const MEASURE_UNITS = new Set(['g', 'kg', 'ml', 'l', 'oz', 'lb', 'fl oz', 'fl_oz']);

function formatQuantity(quantity: number, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(quantity);
}

/** DS-08 food row (52–56, two lines): name + kcal right, serving below. No thumbnail, chevron or container. */
export function DiaryEntryRow({ entry, unit, onPress }: EntryRowProps) {
  const { t } = useTranslation();
  const locale = useFormattingLocale();
  const value = formatEnergy(entry.nutrients.energyKcal, unit, locale);
  const quantity = formatQuantity(entry.servingQuantity ?? 1, locale);
  const servingUnit = entry.servingUnit ?? '';
  const serving = t(MEASURE_UNITS.has(servingUnit.toLowerCase()) ? 'diary.entry.serving' : 'diary.entry.servings', {
    quantity,
    unit: servingUnit,
  });
  return (
    <RowFrame
      testID={`diary-entry-${entry.id}`}
      onPress={onPress}
      a11y={t('diary.entry.a11y', {
        name: entry.name,
        serving,
        value,
        unit: t(`diary.units.${unit}Spoken`),
      })}
      primary={entry.name}
      secondary={serving}
      value={t('diary.meal.energy', { value, unit: t(`diary.units.${unit}`) })}
    />
  );
}

/**
 * DS-08 Quick Calories row: same size and alignment plus an energy marker. A note, when present, is the primary
 * line and "Quick Calories" the secondary. Unknown macros are stated in the accessible label.
 */
export function QuickCaloriesRow({ entry, unit, onPress }: EntryRowProps) {
  const { t } = useTranslation();
  const locale = useFormattingLocale();
  const value = formatEnergy(entry.nutrients.energyKcal, unit, locale);
  const label = t('diary.entry.quickCalories');
  const spoken = t(`diary.units.${unit}Spoken`);
  return (
    <RowFrame
      testID={`diary-entry-${entry.id}`}
      onPress={onPress}
      a11y={
        entry.note
          ? t('diary.entry.quickNoteA11y', { note: entry.note, value, unit: spoken })
          : t('diary.entry.quickA11y', { name: label, value, unit: spoken })
      }
      primary={entry.note ?? label}
      secondary={entry.note ? label : null}
      value={t('diary.meal.energy', { value, unit: t(`diary.units.${unit}`) })}
      marker
    />
  );
}

function RowFrame({
  testID,
  onPress,
  a11y,
  primary,
  secondary,
  value,
  marker = false,
}: {
  testID: string;
  onPress?: () => void;
  a11y: string;
  primary: string;
  secondary: string | null;
  value: string;
  marker?: boolean;
}) {
  const theme = useTheme();
  return (
    <FocusablePressable
      testID={testID}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={a11y}
      style={({ pressed }) => [
        styles.row,
        {
          minHeight: theme.sizes.foodRowDouble[0],
          paddingHorizontal: theme.spacing[4],
          paddingVertical: theme.spacing[1],
          gap: theme.spacing[3],
          backgroundColor: pressed ? theme.colors.primaryTint : theme.colors.surface,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.colors.divider,
        },
      ]}
    >
      <View style={styles.text}>
        <View style={[styles.line, { gap: theme.spacing[1] }]}>
          {marker ? <AppIcon name="flash-outline" size="inline" color="textSecondary" /> : null}
          <AppText variant="body" numberOfLines={1} style={styles.shrink}>
            {primary}
          </AppText>
        </View>
        {secondary ? (
          <AppText variant="compact" color="textSecondary" numberOfLines={1}>
            {secondary}
          </AppText>
        ) : null}
      </View>
      <AppText variant="body" tabular>
        {value}
      </AppText>
    </FocusablePressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  text: { flex: 1 },
  line: { flexDirection: 'row', alignItems: 'center' },
  shrink: { flexShrink: 1 },
});
