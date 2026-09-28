import { useTranslation } from 'react-i18next';
import { FlatList, StyleSheet, View } from 'react-native';

import type { WeightUnit } from '@/domain/units/units';
import { weightFromKg } from '@/domain/units/units';
import { weightHistoryRows, type WeightHistoryRow } from '@/domain/weight/weight';
import { useAppSettings } from '@/features/diary/diary.queries';
import { useDiaryDate } from '@/features/diary/hooks/DiaryDateContext';
import { AppBar, AppText, FocusablePressable, PressableIcon, PrimaryButton } from '@/shared/components';
import type { LocalDate } from '@/shared/dates';
import { formatShortDate, formatWeight } from '@/shared/i18n/format';
import { useFormattingLocale } from '@/shared/i18n/useFormattingLocale';
import { useTheme } from '@/shared/theme';

import { useWeightHistory } from '../profile.queries';

type Props = {
  onBack: () => void;
  /** App bar `+` and the empty state: Weight Entry Sheet in create mode (NAV-06). */
  onAdd: () => void;
  /** Row → Weight Entry Sheet in edit mode (NAV-06). */
  onEdit: (weightEntryId: string) => void;
};

/** `−0.4 kg`: the change in the display unit, 1 decimal, a real minus sign, no judgment color (UX-18). */
export function formatWeightChange(changeKg: number, unit: WeightUnit, locale: string): string {
  const tenths = Math.round(weightFromKg(changeKg, unit) * 10);
  const sign = tenths > 0 ? '+' : tenths < 0 ? '−' : '';
  return `${sign}${formatWeight(Math.abs(changeKg), unit, locale)}`;
}

/** UX-18 / NAV-06 Weight History: newest first, virtualized; each row shows date (+ time), weight and change. */
export function WeightHistoryScreen({ onBack, onAdd, onEdit }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const locale = useFormattingLocale();
  const { today } = useDiaryDate();
  const settings = useAppSettings().data;
  const history = useWeightHistory();
  const rows = history.data ? weightHistoryRows(history.data) : null;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.canvas }}>
      <AppBar
        title={t('weightHistory.title')}
        back={{ label: t('common.back'), onPress: onBack }}
        actions={
          <PressableIcon
            icon="add"
            accessibilityLabel={t('weightHistory.add')}
            onPress={onAdd}
            color="onAppBar"
            testID="weight-history-add"
          />
        }
      />
      {rows && settings ? (
        rows.length === 0 ? (
          <View style={{ padding: theme.spacing[4], gap: theme.spacing[4] }}>
            <AppText variant="body" color="textSecondary">
              {t('weightHistory.empty')}
            </AppText>
            <PrimaryButton label={t('weightHistory.add')} onPress={onAdd} testID="weight-history-empty-add" />
          </View>
        ) : (
          <FlatList
            data={rows}
            keyExtractor={(row) => row.entry.id}
            renderItem={({ item, index }) => (
              <HistoryRow
                row={item}
                index={index}
                unit={settings.weightUnit}
                today={today}
                locale={locale}
                onPress={() => onEdit(item.entry.id)}
              />
            )}
            ItemSeparatorComponent={() => (
              <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.divider }} />
            )}
            contentContainerStyle={{ paddingBottom: theme.spacing[8] }}
          />
        )
      ) : null}
    </View>
  );
}

function HistoryRow({
  row,
  index,
  unit,
  today,
  locale,
  onPress,
}: {
  row: WeightHistoryRow;
  index: number;
  unit: WeightUnit;
  today: LocalDate;
  locale: string;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const unitLabel = t(`units.${unit}`);
  const shortDate = formatShortDate(row.entry.localDate, today, locale);
  const date = row.showTime
    ? t('weightHistory.dateTime', {
        date: shortDate,
        time: new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(
          new Date(row.entry.measuredAt),
        ),
      })
    : shortDate;
  const weight = `${formatWeight(row.entry.weightKg, unit, locale)} ${unitLabel}`;
  const change = row.changeKg === null ? null : `${formatWeightChange(row.changeKg, unit, locale)} ${unitLabel}`;
  return (
    <FocusablePressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        change ? t('weightHistory.row', { date, weight, change }) : t('weightHistory.rowFirst', { date, weight })
      }
      testID={`weight-history-row-${index}`}
      style={({ pressed }) => [
        styles.row,
        {
          minHeight: theme.sizes.settingsRow[1],
          paddingHorizontal: theme.spacing[4],
          paddingVertical: theme.spacing[2],
          gap: theme.spacing[3],
          backgroundColor: pressed ? theme.colors.primaryTint : theme.colors.surface,
        },
      ]}
    >
      <AppText variant="body" style={styles.date}>
        {date}
      </AppText>
      <View style={styles.values}>
        <AppText variant="bodyStrong" tabular>
          {weight}
        </AppText>
        {change ? (
          <AppText variant="compact" color="textSecondary" tabular>
            {change}
          </AppText>
        ) : null}
      </View>
    </FocusablePressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  date: { flex: 1 },
  values: { alignItems: 'flex-end' },
});
