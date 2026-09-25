import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { AppBar } from '@/shared/components';
import { useTheme } from '@/shared/theme';

/** Profile root. M0 shell: app bar only; weight summary and settings rows arrive in M8 (UX-14). */
export function ProfileScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.canvas }}>
      <AppBar title={t('profile.title')} />
    </View>
  );
}
