import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useTheme } from '@/shared/theme';
import { spacing } from '@/shared/theme/tokens';

import { AppText } from './AppText';
import { FocusablePressable } from './FocusablePressable';

export type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** Shows an inline spinner and blocks presses while a save is in flight. */
  loading?: boolean;
  /** Full width only for important persistent actions (DS-09). */
  fullWidth?: boolean;
  accessibilityHint?: string;
  testID?: string;
};

/** Filled green button, one per task region (DS-09). Disabled keeps readable text, not just opacity (DS-10). */
export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  fullWidth = false,
  accessibilityHint,
  testID,
}: PrimaryButtonProps) {
  const theme = useTheme();
  const inactive = disabled || loading;
  return (
    <FocusablePressable
      onPress={onPress}
      disabled={inactive}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        {
          minHeight: theme.sizes.button[0],
          paddingHorizontal: theme.spacing[4] + theme.spacing[0.5],
          borderRadius: theme.radii.pill,
          backgroundColor: disabled
            ? theme.colors.surfaceSubtle
            : pressed
              ? theme.colors.primaryPressed
              : theme.colors.primary,
        },
        disabled && { borderWidth: 1, borderColor: theme.colors.divider },
        fullWidth ? styles.fullWidth : styles.intrinsic,
      ]}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator
            testID="primary-button-spinner"
            size="small"
            // DS-10: onPrimary would vanish on the disabled surfaceSubtle fill.
            color={disabled ? theme.colors.textSecondary : theme.colors.onPrimary}
          />
        ) : null}
        <AppText
          variant="bodyStrong"
          style={{ color: disabled ? theme.colors.textSecondary : theme.colors.onPrimary }}
          numberOfLines={2}
          align="center"
        >
          {label}
        </AppText>
      </View>
    </FocusablePressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
  content: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  fullWidth: { alignSelf: 'stretch' },
  intrinsic: { alignSelf: 'flex-start' },
});
