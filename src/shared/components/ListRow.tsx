import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/shared/theme';

import { AppIcon, type IconName } from './AppIcon';
import { AppText } from './AppText';

export type ListRowProps = {
  label: string;
  /** Current value when useful (DS-09), e.g. `kg`. */
  value?: string;
  icon?: IconName;
  onPress?: () => void;
  /** Shows a chevron. Only for rows that open another screen (DS-09). */
  navigates?: boolean;
  disabled?: boolean;
  accessibilityHint?: string;
  testID?: string;
};

/** Flat grouped-list row, 48–52 high, never a card (DS-02, DS-09). One coherent a11y label (DS-11). */
export function ListRow({
  label,
  value,
  icon,
  onPress,
  navigates = false,
  disabled = false,
  accessibilityHint,
  testID,
}: ListRowProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const content = (
    <>
      {icon ? <AppIcon name={icon} color="textSecondary" /> : null}
      {/* DS-10: disabled rows get less emphasis. */}
      <AppText variant="body" color={disabled ? 'textSecondary' : 'textPrimary'} style={styles.label}>
        {label}
      </AppText>
      {value ? (
        <AppText variant="compact" color="textSecondary" tabular>
          {value}
        </AppText>
      ) : null}
      {navigates ? <AppIcon name="chevron-forward" size="inline" color="textSecondary" /> : null}
    </>
  );
  const rowStyle = [
    styles.row,
    {
      minHeight: theme.sizes.settingsRow[0],
      paddingHorizontal: theme.spacing[4],
      paddingVertical: theme.spacing[2],
      gap: theme.spacing[3],
      backgroundColor: theme.colors.surface,
    },
  ];
  const a11yLabel = value ? t('a11y.labelWithValue', { label, value }) : label;

  if (!onPress) {
    return (
      <View style={rowStyle} testID={testID} accessible accessibilityLabel={a11yLabel}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [rowStyle, pressed && { backgroundColor: theme.colors.primaryTint }]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  label: { flex: 1 },
});
