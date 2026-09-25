import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { AppBar } from '@/shared/components';
import { useTheme } from '@/shared/theme';

/** Diary root. M0 shell: app bar only; the date strip, overview and meals arrive in M2 (UX-02). */
export function DiaryScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.canvas }}>
      <AppBar title={t('diary.title')} />
    </View>
  );
}
