import { ActivityIndicator, StyleSheet } from 'react-native';

import { useTheme } from '@/shared/theme';

import { AppText } from './AppText';
import { FocusablePressable } from './FocusablePressable';

export type HeaderActionProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  /** App bars use high-contrast content; sheet headers use the normal primary action colour. */
  placement?: 'appBar' | 'surface';
  testID?: string;
};

/** Compact iOS-style text action for the trailing edge of a screen or sheet header (DS-07, UX-00). */
export function HeaderAction({
  label,
  onPress,
  disabled = false,
  loading = false,
  placement = 'appBar',
  testID,
}: HeaderActionProps) {
  const theme = useTheme();
  const inactive = disabled || loading;
  const color = placement === 'appBar' ? theme.colors.onAppBar : theme.colors.primary;

  return (
    <FocusablePressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        {
          minHeight: theme.touchMin,
          minWidth: theme.touchMin,
          paddingHorizontal: theme.spacing[3],
          borderRadius: theme.radii.small,
          opacity: disabled ? 0.55 : 1,
        },
        pressed && { backgroundColor: placement === 'appBar' ? 'rgba(255,255,255,0.16)' : theme.colors.primaryTint },
      ]}
    >
      {loading ? <ActivityIndicator size="small" color={color} testID="header-action-spinner" /> : null}
      <AppText variant="bodyStrong" numberOfLines={1} style={{ color }}>
        {label}
      </AppText>
    </FocusablePressable>
  );
}

const styles = StyleSheet.create({
  base: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});
