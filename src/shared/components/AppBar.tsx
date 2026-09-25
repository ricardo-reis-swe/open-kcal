import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/shared/theme';

import { AppText } from './AppText';
import { PressableIcon } from './PressableIcon';

export type AppBarProps = {
  title: string;
  /** Shown on non-root screens (UX-00). */
  back?: { label: string; onPress: () => void };
  /** At most two trailing actions (DS-07), e.g. `PressableIcon`s. */
  actions?: ReactNode;
  testID?: string;
};

/**
 * App bar (DS-07): 52 + top safe area, compact title, no large collapsing title.
 * Light = green bar with high-contrast content; dark = surface with a green accent line.
 */
export function AppBar({ title, back, actions, testID }: AppBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const dark = theme.scheme === 'dark';
  return (
    <View
      testID={testID}
      style={[
        {
          paddingTop: insets.top,
          backgroundColor: theme.colors.appBar,
          borderBottomWidth: dark ? StyleSheet.hairlineWidth * 2 : 0,
          borderBottomColor: theme.colors.primary,
        },
      ]}
    >
      <View
        style={[
          styles.row,
          {
            minHeight: theme.sizes.appBar,
            paddingLeft: back ? theme.spacing[1] : theme.spacing[4],
            paddingRight: theme.spacing[1],
          },
        ]}
      >
        {back ? (
          <PressableIcon icon="chevron-back" accessibilityLabel={back.label} onPress={back.onPress} color="onAppBar" />
        ) : null}
        <AppText
          variant="screenTitle"
          accessibilityRole="header"
          numberOfLines={1}
          style={[styles.title, { color: theme.colors.onAppBar }]}
        >
          {title}
        </AppText>
        {actions ? <View style={styles.actions}>{actions}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  title: { flex: 1 },
  actions: { flexDirection: 'row', alignItems: 'center' },
});
