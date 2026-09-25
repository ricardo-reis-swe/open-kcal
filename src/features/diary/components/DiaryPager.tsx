import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import {
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { addDays, type LocalDate } from '@/shared/dates';

export type DiaryPagerProps = {
  date: LocalDate;
  onChange: (date: LocalDate) => void;
  renderDay: (date: LocalDate, active: boolean) => ReactNode;
};

/**
 * UX-02 swipe: a native paging scroll view holding [previous, selected, next]. The adjacent days are pre-rendered
 * (pages are keyed by date, so a day keeps its loaded content), and after a swipe the pager re-centers on the
 * new selection. The prev/next buttons in the date strip are the gesture alternative (DS-11).
 */
export function DiaryPager({ date, onChange, renderDay }: DiaryPagerProps) {
  const ref = useRef<ScrollView>(null);
  // The pager is full width; start from the window so the first frame already has pages, then track layout.
  const window = useWindowDimensions();
  const [width, setWidth] = useState(window.width);
  // Android can report a momentum end twice (and after the programmatic re-center), which moved two days per
  // swipe on device. Only the first end after a user drag changes the date.
  const dragging = useRef(false);
  const days = [addDays(date, -1), date, addDays(date, 1)];

  // Re-center before paint whenever the selected date (or the width) changes.
  useLayoutEffect(() => {
    if (width > 0) ref.current?.scrollTo({ x: width, animated: false });
  }, [date, width]);

  const onMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width <= 0 || !dragging.current) return;
    dragging.current = false;
    const page = Math.round(event.nativeEvent.contentOffset.x / width);
    if (page === 0) onChange(days[0]!);
    else if (page === 2) onChange(days[2]!);
  };

  return (
    <View style={styles.fill} onLayout={(e) => setWidth(e.nativeEvent.layout.width)} testID="diary-pager">
      {width > 0 ? (
        <ScrollView
          ref={ref}
          testID="diary-pager-scroll"
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          contentOffset={{ x: width, y: 0 }}
          onScrollBeginDrag={() => {
            dragging.current = true;
          }}
          onMomentumScrollEnd={onMomentumScrollEnd}
          scrollEventThrottle={16}
          style={styles.fill}
        >
          {days.map((day) => (
            <View key={day} style={{ width }} testID={day === date ? 'diary-page-active' : undefined}>
              {renderDay(day, day === date)}
            </View>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
