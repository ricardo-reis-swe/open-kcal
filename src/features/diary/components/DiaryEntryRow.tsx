import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import type { DiaryEntry } from '@/data/db/repositories/diaryRepository';
import type { EnergyUnit } from '@/domain/units/units';
import { AppIcon, AppText, FocusablePressable, PressableIcon, SwipeToDelete } from '@/shared/components';
import { formatEnergy } from '@/shared/i18n/format';
import { useFormattingLocale } from '@/shared/i18n/useFormattingLocale';
import { routes, type Origin } from '@/shared/navigation/routes';
import { useTheme } from '@/shared/theme';

export type EntryRowProps = {
  entry: DiaryEntry;
  unit: EnergyUnit;
  /** Row tap → the matching edit screen (UX-02). */
  onPress?: () => void;
  /** Revealed Delete button tap (UX-02). Resolving `false` (the delete failed) closes the row again. */
  onDelete?: () => Promise<boolean> | void;
  onMenu?: () => void;
};

// Serving labels that are measurement units read as `150 g`; anything else is a count: `2 × egg`.
const MEASURE_UNITS = new Set(['g', 'kg', 'ml', 'l', 'oz', 'lb', 'fl oz', 'fl_oz']);

function formatQuantity(quantity: number, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(quantity);
}

/** DS-08 food row (52–56, two lines): name above, serving + kcal below. No thumbnail, chevron or container. */
export function DiaryEntryRow({ entry, unit, onPress, onDelete, onMenu }: EntryRowProps) {
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
      onDelete={onDelete}
      onMenu={onMenu}
    />
  );
}

/**
 * DS-08 Quick Calories row: same size and alignment plus an energy marker. A note, when present, is the primary
 * line and "Quick Calories" the secondary. Unknown macros are stated in the accessible label.
 */
export function QuickCaloriesRow({ entry, unit, onPress, onDelete, onMenu }: EntryRowProps) {
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
      onDelete={onDelete}
      onMenu={onMenu}
    />
  );
}

/** A meal's entries in saved order; a row tap opens the matching edit screen, which returns to `origin` (NAV-04). */
export function MealEntries({
  entries,
  unit,
  origin,
  onDelete,
  onMenu,
}: {
  entries: DiaryEntry[];
  unit: EnergyUnit;
  origin: Origin;
  onDelete?: (entry: DiaryEntry) => Promise<boolean> | void;
  onMenu?: (entry: DiaryEntry) => void;
}) {
  return entries.map((entry) =>
    entry.kind === 'food' ? (
      <DiaryEntryRow
        key={entry.id}
        entry={entry}
        unit={unit}
        onPress={() => router.push(routes.editFoodEntry({ entryId: entry.id, origin }))}
        onDelete={onDelete ? () => onDelete(entry) : undefined}
        onMenu={onMenu ? () => onMenu(entry) : undefined}
      />
    ) : (
      <QuickCaloriesRow
        key={entry.id}
        entry={entry}
        unit={unit}
        onPress={() => router.push(routes.editQuickCalories({ entryId: entry.id, origin }))}
        onDelete={onDelete ? () => onDelete(entry) : undefined}
        onMenu={onMenu ? () => onMenu(entry) : undefined}
      />
    ),
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
  onDelete,
  onMenu,
}: {
  testID: string;
  onPress?: () => void;
  a11y: string;
  primary: string;
  secondary: string | null;
  value: string;
  marker?: boolean;
  onDelete?: () => Promise<boolean> | void;
  onMenu?: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <SwipeToDelete testID={`${testID}-swipe`} label={t('common.delete')} onDelete={onDelete}>
      <View style={styles.row}>
        <FocusablePressable
          testID={testID}
          onPress={onPress}
          disabled={!onPress}
          accessibilityRole={onPress ? 'button' : 'text'}
          accessibilityLabel={a11y}
          accessibilityActions={onDelete ? [{ name: 'delete', label: t('diary.entry.delete') }] : undefined}
          onAccessibilityAction={(event) => {
            if (event.nativeEvent.actionName === 'delete') onDelete?.();
          }}
          style={({ pressed }) => [
            styles.row,
            styles.text,
            {
              minHeight: theme.sizes.foodRowDouble[0],
              paddingLeft: theme.spacing[4],
              paddingVertical: theme.spacing[1],
              gap: theme.spacing[3],
              backgroundColor: pressed ? theme.colors.primaryTint : theme.colors.surface,
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: theme.colors.divider,
            },
          ]}
        >
          <View style={[styles.text, styles.content]}>
            <View style={[styles.line, { gap: theme.spacing[1] }]}>
              {marker ? <AppIcon name="flash-outline" size="inline" color="textSecondary" /> : null}
              <AppText variant="body" numberOfLines={1} style={styles.shrink}>
                {primary}
              </AppText>
            </View>
            <View testID={`${testID}-details`} style={[styles.line, { gap: theme.spacing[2] }]}>
              {secondary ? (
                <AppText variant="compact" color="textSecondary" numberOfLines={1} style={styles.shrink}>
                  {secondary}
                </AppText>
              ) : null}
              <AppText variant="compact" color="textSecondary" numberOfLines={1} tabular>
                {value}
              </AppText>
            </View>
          </View>
        </FocusablePressable>
        <View
          style={[
            styles.menu,
            {
              backgroundColor: theme.colors.surface,
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: theme.colors.divider,
            },
          ]}
        >
          <PressableIcon
            icon="ellipsis-horizontal"
            accessibilityLabel={t('diary.entry.menu', { name: primary })}
            onPress={onMenu ?? (() => undefined)}
            disabled={!onMenu}
            color="textSecondary"
            testID={`${testID}-menu`}
          />
        </View>
      </View>
    </SwipeToDelete>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  text: { flex: 1 },
  content: { minWidth: 0 },
  line: { flexDirection: 'row', alignItems: 'center' },
  shrink: { flexShrink: 1 },
  menu: { alignSelf: 'stretch', justifyContent: 'center' },
});
