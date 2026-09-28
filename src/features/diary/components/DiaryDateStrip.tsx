import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, StyleSheet, View, type AccessibilityActionEvent } from 'react-native';

import { AppText, FocusablePressable } from '@/shared/components';
import { addDays, type LocalDate } from '@/shared/dates';
import { formatShortDate, relativeDay } from '@/shared/i18n/format';
import { useFormattingLocale } from '@/shared/i18n/useFormattingLocale';
import { useTheme } from '@/shared/theme';

import {
  centerOffset,
  extendEnd,
  extendStart,
  indexInWindow,
  needsReanchor,
  windowAround,
  windowDates,
} from './dateStripWindow';

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
 * DS-07 date strip (42) under the Diary title: a horizontally scrollable row of days (UX-02). Scrolling the strip
 * never changes the day; tapping one selects it. Whenever the selected day changes (strip/overview button, Today,
 * Date Picker), the strip animates to center it, even after the user scrolled it away. The selected day also has
 * increment/decrement accessibility actions (DS-11).
 */
export function DiaryDateStrip({ date, today, onChange }: DiaryDateStripProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const label = useDiaryDateLabel();
  const itemWidth = theme.sizes.dateStripItem;
  const ref = useRef<FlatList<LocalDate>>(null);
  const [strip, setStrip] = useState(() => windowAround(date));
  // A re-anchor remounts the list so it opens on the selected day (also keeps Jest's rendered range on it).
  const [generation, setGeneration] = useState(0);
  const [listWidth, setListWidth] = useState(0);
  if (needsReanchor(strip, date)) {
    setStrip(windowAround(date));
    setGeneration((g) => g + 1);
  }
  // The latest window, read by the centering effect without re-centering when the user's scrolling extends it.
  const stripRef = useRef(strip);
  useLayoutEffect(() => {
    stripRef.current = strip;
  }, [strip]);
  const centered = useRef<number | null>(null);

  // Center on every selection change and width change (the Today button coming or going resizes the list; an
  // instant re-center there lost to the selection's in-flight animation on Android). Only the first centering of a
  // (re)mounted list is instant.
  useEffect(() => {
    if (listWidth <= 0) return;
    const animated = centered.current === generation;
    centered.current = generation;
    const offset = centerOffset(indexInWindow(stripRef.current, date), itemWidth, listWidth);
    ref.current?.scrollToOffset({ offset, animated });
  }, [date, generation, listWidth, itemWidth]);

  const prev = addDays(date, -1);
  const next = addDays(date, 1);
  const onAccessibilityAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === 'increment') onChange(next);
    else if (event.nativeEvent.actionName === 'decrement') onChange(prev);
  };
  const itemLabel = (day: LocalDate) => {
    const text = label(day, today);
    if (day === date) return t('diary.selectedDay', { label: text });
    if (day === prev) return t('diary.previousDay', { label: text });
    if (day === next) return t('diary.nextDay', { label: text });
    return text;
  };
  const minHeight = Math.max(theme.sizes.dateStrip, theme.touchMin);

  return (
    <View style={[styles.row, { paddingHorizontal: theme.spacing[1] }]} testID="diary-date-strip">
      <FlatList
        key={generation}
        ref={ref}
        testID="diary-date-strip-list"
        horizontal
        showsHorizontalScrollIndicator={false}
        data={windowDates(strip)}
        extraData={`${date}|${today}`}
        keyExtractor={(day) => day}
        getItemLayout={(_, index) => ({ length: itemWidth, offset: itemWidth * index, index })}
        initialScrollIndex={Math.max(0, indexInWindow(strip, date) - 2)}
        initialNumToRender={9}
        windowSize={5}
        onLayout={(e) => setListWidth(e.nativeEvent.layout.width)}
        onEndReachedThreshold={2}
        onEndReached={() => setStrip((w) => extendEnd(w))}
        onStartReachedThreshold={2}
        onStartReached={() => setStrip((w) => extendStart(w))}
        // Prepending days keeps the visible ones in place.
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
        style={styles.list}
        renderItem={({ item: day }) => {
          const selected = day === date;
          return (
            <FocusablePressable
              testID={selected ? 'diary-selected-day' : `diary-day-${day}`}
              accessibilityRole="button"
              accessibilityLabel={itemLabel(day)}
              accessibilityState={{ selected }}
              {...(selected
                ? {
                    accessibilityActions: [
                      { name: 'increment', label: t('diary.nextDay', { label: label(next, today) }) },
                      { name: 'decrement', label: t('diary.previousDay', { label: label(prev, today) }) },
                    ],
                    onAccessibilityAction,
                  }
                : {})}
              onPress={() => onChange(day)}
              style={({ pressed }) => [
                styles.item,
                { width: itemWidth, minHeight, paddingHorizontal: theme.spacing[1] },
                pressed && styles.pressed,
              ]}
            >
              <AppText
                variant={selected ? 'compactStrong' : 'compact'}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
                align="center"
                style={{ color: theme.colors.onAppBar }}
              >
                {label(day, today)}
              </AppText>
              {/* Short underline under the selected date (DS-07); the text weight also marks it. */}
              <View
                style={[
                  styles.indicator,
                  { marginTop: theme.spacing[0.5], backgroundColor: selected ? theme.colors.onAppBar : 'transparent' },
                ]}
              />
            </FocusablePressable>
          );
        }}
      />
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
              marginLeft: theme.spacing[1],
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
  list: { flex: 1 },
  item: { alignItems: 'center', justifyContent: 'center' },
  indicator: { width: 24, height: 2, borderRadius: 1 },
  today: { justifyContent: 'center', borderWidth: 1 },
  pressed: { opacity: 0.7 },
});
