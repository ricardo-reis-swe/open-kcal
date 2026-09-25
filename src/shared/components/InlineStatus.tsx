import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useTheme, type Colors } from '@/shared/theme';

import { AppIcon, type IconName } from './AppIcon';
import { AppText } from './AppText';
import { TextAction } from './TextAction';

export type StatusTone = 'info' | 'loading' | 'success' | 'warning' | 'error' | 'offline';

export type InlineStatusProps = {
  tone: StatusTone;
  message: string;
  /** Optional recovery action, e.g. `Retry` or `Set goals`. */
  action?: { label: string; onPress: () => void };
  testID?: string;
};

const TONES: Record<Exclude<StatusTone, 'loading'>, { icon: IconName; color: keyof Colors; bg: keyof Colors }> = {
  info: { icon: 'information-circle-outline', color: 'textSecondary', bg: 'surfaceSubtle' },
  success: { icon: 'checkmark-circle-outline', color: 'primary', bg: 'primaryTint' },
  warning: { icon: 'warning-outline', color: 'warning', bg: 'warningTint' },
  error: { icon: 'alert-circle-outline', color: 'danger', bg: 'dangerTint' },
  offline: { icon: 'cloud-offline-outline', color: 'textSecondary', bg: 'surfaceSubtle' },
};

/** Inline status row: icon or spinner + words, never color alone (DS-10, DS-11). */
export function InlineStatus({ tone, message, action, testID }: InlineStatusProps) {
  const theme = useTheme();
  const spec = tone === 'loading' ? undefined : TONES[tone];
  return (
    <View
      testID={testID}
      style={[
        styles.row,
        {
          gap: theme.spacing[2],
          paddingHorizontal: theme.spacing[3],
          paddingVertical: theme.spacing[2],
          borderRadius: theme.radii.small,
          backgroundColor: theme.colors[spec?.bg ?? 'surfaceSubtle'],
        },
      ]}
    >
      {spec ? (
        <AppIcon name={spec.icon} size="inline" color={spec.color} />
      ) : (
        <ActivityIndicator size="small" color={theme.colors.textSecondary} />
      )}
      <AppText
        variant="compact"
        color={tone === 'error' ? 'danger' : 'textPrimary'}
        style={styles.message}
        accessibilityRole={tone === 'error' ? 'alert' : 'text'}
        accessibilityLiveRegion="polite"
      >
        {message}
      </AppText>
      {action ? <TextAction label={action.label} onPress={action.onPress} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  message: { flex: 1 },
});
