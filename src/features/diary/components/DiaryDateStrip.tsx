import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText, FocusablePressable } from '@/shared/components';
import { addDays, type LocalDate } from '@/shared/dates';
import { formatShortDate, relativeDay } from '@/shared/i18n/format';
import { useFormattingLocale } from '@/shared/i18n/useFormattingLocale';
import { useTheme } from '@/shared/theme';

export type DiaryDateStripProps = {
  date: LocalDate;
  today: LocalDate;
  onChange: (date: LocalDate) => void;
};

/** UX-02: Yesterday/Today/Tomorrow within ±1 day of today, otherwise a locale short date. */
export function useDiaryDateLabel() {
  const { t } = useTranslation();
  const locale = useFormattingLocale();
  return (date: LocalDate, today: LocalDate) => {
    const relative = relativeDay(date, today);
    return relative ? t(`diary.${relative}`) : formatShortDate(date, today, locale);
  };
}

/**
 * DS-07 date strip (42) under the Diary title, in the app-bar family: prev / selected / next evenly spaced, plus a
 * compact Today when not on today. Prev/next are the button alternative to the swipe gesture (DS-11).
 */
export function DiaryDateStrip({ date, today, onChange }: DiaryDateStripProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const label = useDiaryDateLabel();
  const prev = addDays(date, -1);
  const next = addDays(date, 1);
  const selected = label(date, today);
  const cell = { minHeight: Math.max(theme.sizes.dateStrip, theme.touchMin), paddingHorizontal: theme.spacing[1] };
  return (
    <View style={[styles.row, { paddingHorizontal: theme.spacing[2] }]} testID="diary-date-strip">
      <FocusablePressable
        testID="diary-prev-day"
        accessibilityRole="button"
        accessibilityLabel={t('diary.previousDay', { label: label(prev, today) })}
        onPress={() => onChange(prev)}
        style={({ pressed }) => [styles.cell, cell, pressed && styles.pressed]}
      >
        <AppText variant="compact" numberOfLines={1} style={{ color: theme.colors.onAppBar }}>
          {`‹ ${label(prev, today)}`}
        </AppText>
      </FocusablePressable>
      <View
        testID="diary-selected-day"
        accessible
        accessibilityRole="text"
        accessibilityLabel={t('diary.selectedDay', { label: selected })}
        style={[styles.cell, cell]}
      >
        <AppText variant="compactStrong" numberOfLines={1} style={{ color: theme.colors.onAppBar }}>
          {selected}
        </AppText>
        <View style={[styles.indicator, { backgroundColor: theme.colors.onAppBar, marginTop: theme.spacing[0.5] }]} />
      </View>
      <FocusablePressable
        testID="diary-next-day"
        accessibilityRole="button"
        accessibilityLabel={t('diary.nextDay', { label: label(next, today) })}
        onPress={() => onChange(next)}
        style={({ pressed }) => [styles.cell, cell, pressed && styles.pressed]}
      >
        <AppText variant="compact" numberOfLines={1} style={{ color: theme.colors.onAppBar }}>
          {`${label(next, today)} ›`}
        </AppText>
      </FocusablePressable>
      {date !== today ? (
        <FocusablePressable
          testID="diary-go-today"
          accessibilityRole="button"
          accessibilityLabel={t('diary.goToTodayLabel')}
          onPress={() => onChange(today)}
          hitSlop={{ top: theme.spacing[2], bottom: theme.spacing[2] }}
          style={({ pressed }) => [
            styles.today,
            {
              paddingVertical: theme.spacing[1],
              paddingHorizontal: theme.spacing[2],
              borderRadius: theme.radii.small,
              borderColor: theme.colors.onAppBar,
            },
            pressed && styles.pressed,
          ]}
        >
          <AppText variant="compactStrong" style={{ color: theme.colors.onAppBar }}>
            {t('diary.goToToday')}
          </AppText>
        </FocusablePressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  cell: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // Short underline under the selected date (DS-07); the text weight also marks it.
  indicator: { width: 24, height: 2, borderRadius: 1 },
  today: { justifyContent: 'center', borderWidth: 1 },
  pressed: { opacity: 0.7 },
});
