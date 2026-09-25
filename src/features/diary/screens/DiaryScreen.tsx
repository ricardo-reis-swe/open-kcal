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
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.canvas }}>
      <AppBar title={t('diary.title')} bottom={<DiaryDateStrip date={date} today={today} onChange={setDate} />} />
      <DiaryPager date={date} onChange={setDate} renderDay={(day, active) => <DiaryDay date={day} active={active} />} />
    </View>
  );
}
