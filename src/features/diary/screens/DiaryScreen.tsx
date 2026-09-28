import { useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { AppBar, PressableIcon } from '@/shared/components';
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
      <View style={{ flex: 1 }} testID="diary-page-active">
        <DiaryDay date={date} active scrollToTop={scrollToTop} />
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
