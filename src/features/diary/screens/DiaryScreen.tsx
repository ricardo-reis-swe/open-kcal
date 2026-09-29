import { useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { AppBar, PressableIcon } from '@/shared/components';
import { addDays } from '@/shared/dates';
import { DatePicker } from '@/shared/navigation/DatePicker';
import { useTheme } from '@/shared/theme';

import { DiaryDateStrip } from '../components/DiaryDateStrip';
import { DiaryDay } from '../components/DiaryDay';
import { useDiaryDate } from '../hooks/DiaryDateContext';

/** Diary root: the date strip stays horizontally scrollable while the day content itself is not swipeable. */
export function DiaryScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { date, today, setDate } = useDiaryDate();
  const navigation = useNavigation();
  // NAV-02: the Diary tab tapped while already at the Diary root scrolls the day to the top (deeper, it pops).
  const [scrollToTop, setScrollToTop] = useState(0);
  const [pickingDate, setPickingDate] = useState(false);
  // Keep the adjacent dates mounted and data-loaded. When selection moves one day, its page is already rendered;
  // only the newly-adjacent page needs to start loading.
  const pageDates = [addDays(date, -1), date, addDays(date, 1)];
  useEffect(() => {
    const tabs = navigation.getParent();
    if (!tabs) return;
    return tabs.addListener('tabPress' as never, () => {
      if (navigation.isFocused()) setScrollToTop((n) => n + 1);
    });
  }, [navigation]);
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.canvas }}>
      <AppBar
        title={t('diary.title')}
        actions={
          <PressableIcon
            icon="calendar-outline"
            accessibilityLabel={t('diary.chooseDate')}
            onPress={() => setPickingDate(true)}
            color="onAppBar"
            testID="diary-choose-date"
          />
        }
        bottom={<DiaryDateStrip date={date} today={today} onChange={setDate} />}
      />
      <View style={{ flex: 1 }}>
        {pageDates.map((pageDate) => {
          const active = pageDate === date;
          return (
            <View
              key={pageDate}
              testID={active ? 'diary-page-active' : `diary-page-preloaded-${pageDate}`}
              pointerEvents={active ? 'auto' : 'none'}
              accessibilityElementsHidden={!active}
              importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}
              style={active ? { flex: 1 } : { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, opacity: 0 }}
            >
              <DiaryDay date={pageDate} active={active} scrollToTop={active ? scrollToTop : 0} />
            </View>
          );
        })}
      </View>
      {/* NAV-05: opens on the active date; Done → Diary on that date; Cancel → no change; Today = the Today action. */}
      <DatePicker
        visible={pickingDate}
        value={date}
        today={today}
        onConfirm={(picked) => {
          setPickingDate(false);
          setDate(picked);
        }}
        onCancel={() => setPickingDate(false)}
      />
    </View>
  );
}
