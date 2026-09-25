import { useTranslation } from 'react-i18next';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { AppIcon, AppText, FocusablePressable } from '@/shared/components';
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
  // DS-11: at large text the neighbours shrink to chevrons (full names stay in their labels) and the selected
  // date shrinks to fit, so nothing essential is truncated.
  const compact = useWindowDimensions().fontScale >= LARGE_TEXT;
  const cell = { minHeight: Math.max(theme.sizes.dateStrip, theme.touchMin), paddingHorizontal: theme.spacing[1] };
  return (
    <View style={[styles.row, { paddingHorizontal: theme.spacing[2] }]} testID="diary-date-strip">
      <FocusablePressable
        testID="diary-prev-day"
        accessibilityRole="button"
        accessibilityLabel={t('diary.previousDay', { label: label(prev, today) })}
        onPress={() => onChange(prev)}
        style={({ pressed }) => [compact ? styles.chevron : styles.cell, cell, pressed && styles.pressed]}
      >
        {compact ? (
          <AppIcon name="chevron-back" color="onAppBar" />
        ) : (
          <AppText variant="compact" numberOfLines={1} style={{ color: theme.colors.onAppBar }}>
            {t('diary.prevLabel', { label: label(prev, today) })}
          </AppText>
        )}
      </FocusablePressable>
      <View
        testID="diary-selected-day"
        accessible
        accessibilityRole="text"
        accessibilityLabel={t('diary.selectedDay', { label: selected })}
        style={[styles.cell, cell]}
      >
        {/* At the largest sizes the date shrinks a little to stay whole instead of truncating or breaking a word. */}
        <AppText
          variant="compactStrong"
          numberOfLines={1}
          adjustsFontSizeToFit={compact}
          minimumFontScale={0.5}
          align="center"
          style={{ color: theme.colors.onAppBar }}
        >
          {selected}
        </AppText>
        <View style={[styles.indicator, { backgroundColor: theme.colors.onAppBar, marginTop: theme.spacing[0.5] }]} />
      </View>
      <FocusablePressable
        testID="diary-next-day"
        accessibilityRole="button"
        accessibilityLabel={t('diary.nextDay', { label: label(next, today) })}
        onPress={() => onChange(next)}
        style={({ pressed }) => [compact ? styles.chevron : styles.cell, cell, pressed && styles.pressed]}
      >
        {compact ? (
          <AppIcon name="chevron-forward" color="onAppBar" />
        ) : (
          <AppText variant="compact" numberOfLines={1} style={{ color: theme.colors.onAppBar }}>
            {t('diary.nextLabel', { label: label(next, today) })}
          </AppText>
        )}
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

const LARGE_TEXT = 1.5;

const styles = StyleSheet.create({
  chevron: { alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  cell: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // Short underline under the selected date (DS-07); the text weight also marks it.
  indicator: { width: 24, height: 2, borderRadius: 1 },
  today: { justifyContent: 'center', borderWidth: 1 },
  pressed: { opacity: 0.7 },
});
