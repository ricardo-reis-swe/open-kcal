import { useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { AppBar } from '@/shared/components';
import { useTheme } from '@/shared/theme';

import { DiaryDateStrip } from '../components/DiaryDateStrip';
import { DiaryDay } from '../components/DiaryDay';
import { DiaryPager } from '../components/DiaryPager';
import { useDiaryDate } from '../hooks/DiaryDateContext';

/** Diary root (UX-02, NAV-04): app bar + date strip, then the swipeable day. Past/today/future are identical. */
export function DiaryScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { date, today, setDate } = useDiaryDate();
  const navigation = useNavigation();
  // NAV-02: the Diary tab tapped while already at the Diary root scrolls the day to the top (deeper, it pops).
  const [scrollToTop, setScrollToTop] = useState(0);
  useEffect(() => {
    const tabs = navigation.getParent();
    if (!tabs) return;
    return tabs.addListener('tabPress' as never, () => {
      if (navigation.isFocused()) setScrollToTop((n) => n + 1);
    });
  }, [navigation]);
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.canvas }}>
      <AppBar title={t('diary.title')} bottom={<DiaryDateStrip date={date} today={today} onChange={setDate} />} />
      <DiaryPager
        date={date}
        onChange={setDate}
        renderDay={(day, active) => <DiaryDay date={day} active={active} scrollToTop={scrollToTop} />}
      />
    </View>
  );
}
