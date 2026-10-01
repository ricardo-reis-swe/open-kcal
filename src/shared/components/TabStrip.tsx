import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/shared/theme';

import { AppText } from './AppText';
import { FocusablePressable } from './FocusablePressable';

export type TabStripProps<Id extends string> = {
  tabs: readonly { id: Id; label: string }[];
  selected: Id;
  onSelect: (id: Id) => void;
  accessibilityLabel: string;
  testID?: string;
};

/** DS-15 in-screen tabs: equal-width text tabs with the DS-09 selected underline, 48 targets, tab semantics. */
export function TabStrip<Id extends string>({
  tabs,
  selected,
  onSelect,
  accessibilityLabel,
  testID,
}: TabStripProps<Id>) {
  const theme = useTheme();
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={[styles.row, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.divider }]}
    >
      {tabs.map((tab) => {
        const active = tab.id === selected;
        return (
          <FocusablePressable
            key={tab.id}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: active }}
            onPress={() => {
              if (!active) onSelect(tab.id);
            }}
            testID={testID ? `${testID}-${tab.id}` : undefined}
            style={({ pressed }) => [
              styles.tab,
              {
                minHeight: theme.touchMin,
                paddingHorizontal: theme.spacing[2],
                borderBottomWidth: 2,
                borderBottomColor: active ? theme.colors.primary : 'transparent',
              },
              pressed && { backgroundColor: theme.colors.primaryTint },
            ]}
          >
            <AppText
              variant="compactStrong"
              color={active ? 'primary' : 'textSecondary'}
              numberOfLines={2}
              align="center"
            >
              {tab.label}
            </AppText>
          </FocusablePressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
