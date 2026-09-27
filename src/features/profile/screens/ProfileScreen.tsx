import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { AppBar, ListRow } from '@/shared/components';
import { useTheme } from '@/shared/theme';

/** Profile root. M0 shell: app bar only; weight summary and settings rows arrive in M8 (UX-14). */
export function ProfileScreen({ onFoodDatabases }: { onFoodDatabases?: () => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.canvas }}>
      <AppBar title={t('profile.title')} />
      <ListRow label={t('profile.foodDatabases')} navigates onPress={onFoodDatabases} testID="profile-food-databases" />
    </View>
  );
}
