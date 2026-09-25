import { Pressable, StyleSheet } from 'react-native';

import { useTheme } from '@/shared/theme';

import { AppIcon, type IconName } from './AppIcon';
import { AppText } from './AppText';

export type TextActionProps = {
  label: string;
  onPress: () => void;
  icon?: IconName;
  /** `danger` for destructive text actions such as `Delete entry` (DS-09, UX-00). */
  tone?: 'primary' | 'danger';
  disabled?: boolean;
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
  accessibilityHint,
  testID,
}: TextActionProps) {
  const theme = useTheme();
  const color = disabled ? 'textSecondary' : tone;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.base,
        {
          minHeight: theme.touchMin,
          paddingHorizontal: theme.spacing[2],
          borderRadius: theme.radii.small,
          gap: theme.spacing[1],
        },
        pressed && { backgroundColor: tone === 'danger' ? theme.colors.dangerTint : theme.colors.primaryTint },
      ]}
    >
      {icon ? <AppIcon name={icon} size="inline" color={color} /> : null}
      <AppText variant="compactStrong" color={color}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' },
});
