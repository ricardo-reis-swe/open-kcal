import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/shared/theme';

import { AppText } from './AppText';
import { PrimaryButton } from './PrimaryButton';

export type NotFoundStateProps = {
  /** e.g. `Back to Diary`: returns to the stack root (UX-00). */
  actionLabel: string;
  onAction: () => void;
};

/** UX-00 not found: bad params, or the record was deleted elsewhere. Replaces the screen content. */
export function NotFoundState({ actionLabel, onAction }: NotFoundStateProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <View style={[styles.center, { padding: theme.spacing[4], gap: theme.spacing[4] }]} testID="not-found">
      <AppText variant="sectionTitle" align="center">
        {t('common.notFound')}
      </AppText>
      <PrimaryButton label={actionLabel} onPress={onAction} />
    </View>
  );
}

const styles = StyleSheet.create({ center: { flex: 1, alignItems: 'center', justifyContent: 'center' } });
