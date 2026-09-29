import { StyleSheet } from 'react-native';

import { useTheme } from '@/shared/theme';

import { AppIcon, type IconName } from './AppIcon';
import { AppText } from './AppText';
import { FocusablePressable } from './FocusablePressable';

export type TextActionProps = {
  label: string;
  onPress: () => void;
  icon?: IconName;
  /** `danger` for destructive text actions such as `Delete entry` (DS-09, UX-00). */
  tone?: 'primary' | 'danger';
  disabled?: boolean;
  /** Shows the compact selected-state indicator used by controls such as serving unit tabs (DS-09). */
  selected?: boolean;
  /** Expands the action across its parent row while retaining its tertiary visual treatment. */
  fullWidth?: boolean;
  accessibilityHint?: string;
  testID?: string;
};

/** Tertiary action: text (+ icon), no container, full touch target (DS-09). */
export function TextAction({
  label,
  onPress,
  icon,
  tone = 'primary',
  disabled = false,
  selected = false,
  fullWidth = false,
  accessibilityHint,
  testID,
}: TextActionProps) {
  const theme = useTheme();
  const color = disabled ? 'textSecondary' : tone;
  return (
    <FocusablePressable
      onPress={onPress}
      disabled={disabled}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled, selected }}
      style={({ pressed }) => [
        styles.base,
        fullWidth && styles.fullWidth,
        {
          minHeight: theme.touchMin,
          paddingHorizontal: theme.spacing[2],
          borderRadius: theme.radii.small,
          borderBottomWidth: 2,
          borderBottomColor: selected ? theme.colors.primary : 'transparent',
          gap: theme.spacing[1],
        },
        pressed && { backgroundColor: tone === 'danger' ? theme.colors.dangerTint : theme.colors.primaryTint },
      ]}
    >
      {icon ? <AppIcon name={icon} size="inline" color={color} /> : null}
      <AppText variant="compactStrong" color={color}>
        {label}
      </AppText>
    </FocusablePressable>
  );
}

const styles = StyleSheet.create({
  base: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' },
  fullWidth: { alignSelf: 'stretch' },
});
