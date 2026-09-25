import { View } from 'react-native';

import { useTheme } from '@/shared/theme';

import { AppText } from './AppText';

export type SectionHeaderProps = {
  label: string;
  /** Restrained uppercase for short section labels only (DS-04). Never for user meal names. */
  uppercase?: boolean;
  testID?: string;
};

/** Short section label for grouped lists and search sections (DS-09). */
export function SectionHeader({ label, uppercase = false, testID }: SectionHeaderProps) {
  const theme = useTheme();
  return (
    <View
      testID={testID}
      style={{ paddingHorizontal: theme.spacing[4], paddingTop: theme.spacing[4], paddingBottom: theme.spacing[2] }}
    >
      <AppText
        variant="label"
        color="textSecondary"
        accessibilityRole="header"
        // Letter spacing is typographic tracking for uppercase labels, not layout spacing, so it isn't a spacing token.
        style={uppercase ? { textTransform: 'uppercase', letterSpacing: 0.4 } : undefined}
      >
        {label}
      </AppText>
    </View>
  );
}
