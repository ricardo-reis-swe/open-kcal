import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

import { useTheme, type Colors } from '@/shared/theme';

// DS-06: one rounded icon family (Ionicons), outline by default; filled only for selected states.
export type IconName = ComponentProps<typeof Ionicons>['name'];
export type IconSize = 'inline' | 'standard' | 'centerAction';

export type AppIconProps = {
  name: IconName;
  size?: IconSize;
  color?: keyof Colors;
  testID?: string;
};

/** Decorative by default: hidden from screen readers. Meaning comes from the labelled parent (DS-06, DS-11). */
export function AppIcon({ name, size = 'standard', color = 'textPrimary', testID }: AppIconProps) {
  const theme = useTheme();
  const px =
    size === 'inline'
      ? theme.sizes.icon.inline
      : size === 'centerAction'
        ? theme.sizes.icon.centerAction
        : theme.sizes.icon.standard[1];
  return (
    <Ionicons
      name={name}
      size={px}
      color={theme.colors[color]}
      testID={testID}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}
