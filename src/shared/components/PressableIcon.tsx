import { StyleSheet } from 'react-native';

import { useTheme, type Colors } from '@/shared/theme';

import { AppIcon, type IconName } from './AppIcon';
import { FocusablePressable } from './FocusablePressable';

export type PressableIconProps = {
  icon: IconName;
  /** Required: icon-only actions always have an accessible label (DS-06, DS-09). */
  accessibilityLabel: string;
  accessibilityHint?: string;
  onPress: () => void;
  color?: keyof Colors;
  disabled?: boolean;
  /** Disclosure toggles expose their state (DS-11). */
  expanded?: boolean;
  /** Toggles (e.g. UX-04 select mode) expose their on state. */
  selected?: boolean;
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
  expanded,
  selected,
  testID,
}: PressableIconProps) {
  const theme = useTheme();
  return (
    <FocusablePressable
      onPress={onPress}
      disabled={disabled}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{
        disabled,
        ...(expanded === undefined ? {} : { expanded }),
        ...(selected === undefined ? {} : { selected }),
      }}
      style={({ pressed }) => [
        styles.base,
        { minWidth: theme.touchMin, minHeight: theme.touchMin, borderRadius: theme.radii.pill },
        pressed && { backgroundColor: theme.colors.primaryTint },
      ]}
    >
      <AppIcon name={icon} color={disabled ? 'textSecondary' : color} />
    </FocusablePressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
});
