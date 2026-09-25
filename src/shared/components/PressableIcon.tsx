import { Pressable, StyleSheet } from 'react-native';

import { useTheme, type Colors } from '@/shared/theme';

import { AppIcon, type IconName } from './AppIcon';

export type PressableIconProps = {
  icon: IconName;
  /** Required: icon-only actions always have an accessible label (DS-06, DS-09). */
  accessibilityLabel: string;
  accessibilityHint?: string;
  onPress: () => void;
  color?: keyof Colors;
  disabled?: boolean;
  testID?: string;
};

/** Icon action: 20–24 icon inside a full platform touch target (DS-09). */
export function PressableIcon({
  icon,
  accessibilityLabel,
  accessibilityHint,
  onPress,
  color = 'textPrimary',
  disabled = false,
  testID,
}: PressableIconProps) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.base,
        { minWidth: theme.touchMin, minHeight: theme.touchMin, borderRadius: theme.radii.pill },
        pressed && { backgroundColor: theme.colors.primaryTint },
      ]}
    >
      <AppIcon name={icon} color={disabled ? 'textSecondary' : color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
});
