import type { BottomTabBarProps } from 'expo-router/tabs';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppIcon, AppText, FocusablePressable, type IconName } from '@/shared/components';
import { useTheme } from '@/shared/theme';
import { spacing } from '@/shared/theme/tokens';

type TabRoute = 'diary' | 'profile';

const TAB_LABEL_MAX_SCALE = 2;

const TABS: Record<TabRoute, { labelKey: 'tabs.diary' | 'tabs.profile'; icon: IconName; iconSelected: IconName }> = {
  diary: { labelKey: 'tabs.diary', icon: 'book-outline', iconSelected: 'book' },
  profile: { labelKey: 'tabs.profile', icon: 'person-outline', iconSelected: 'person' },
};

type Props = BottomTabBarProps & { onAddPress: () => void };

/**
 * Bottom nav (DS-07, NAV-02): exactly `Diary  +  Profile`. `+` is an action, owns no stack and is never selected.
 * Pressing the focused tab emits `tabPress`, which pops its stack to root (NAV-02).
 */
export function AppTabBar({ state, navigation, onAddPress }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const renderTab = (routeName: TabRoute) => {
    const index = state.routes.findIndex((r) => r.name === routeName);
    const route = state.routes[index];
    if (!route) return null;
    const focused = state.index === index;
    const spec = TABS[routeName];
    const label = t(spec.labelKey);
    const onPress = () => {
      const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
      if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
    };
    return (
      <FocusablePressable
        key={route.key}
        onPress={onPress}
        onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
        accessibilityRole="tab"
        accessibilityLabel={label}
        accessibilityState={{ selected: focused }}
        testID={`tab-${routeName}`}
        style={({ pressed }) => [
          styles.tab,
          { minHeight: theme.touchMin, borderRadius: theme.radii.medium },
          pressed && { backgroundColor: theme.colors.primaryTint },
        ]}
      >
        <AppIcon name={focused ? spec.iconSelected : spec.icon} color={focused ? 'primary' : 'textSecondary'} />
        {/* Same size in both states (no layout shift); selection = color + weight + filled icon (DS-07, DS-11).
            Scales up to 2× (Android's max font scale) so a third-width tab never clips its label at iOS AX sizes. */}
        <AppText
          variant="label"
          color={focused ? 'primary' : 'textSecondary'}
          numberOfLines={1}
          maxFontSizeMultiplier={TAB_LABEL_MAX_SCALE}
          style={{ fontWeight: focused ? '700' : '500' }}
        >
          {label}
        </AppText>
      </FocusablePressable>
    );
  };

  const addSize = theme.sizes.centerAction;
  return (
    <View
      // `tabbar` is iOS-only; Android throws on unknown roles.
      accessibilityRole={Platform.OS === 'ios' ? 'tabbar' : undefined}
      testID="tab-bar"
      style={[
        styles.bar,
        {
          minHeight: theme.sizes.bottomNav + insets.bottom,
          paddingBottom: insets.bottom,
          paddingHorizontal: theme.spacing[4],
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.divider,
        },
        theme.elevation(1),
      ]}
    >
      {renderTab('diary')}
      <View style={styles.addSlot}>
        <FocusablePressable
          onPress={onAddPress}
          accessibilityRole="button"
          accessibilityLabel={t('tabs.add')}
          testID="tab-add"
          hitSlop={Math.max(0, (theme.touchMin - addSize) / 2)}
          style={({ pressed }) => [
            styles.add,
            {
              width: addSize,
              height: addSize,
              borderRadius: theme.radii.pill,
              marginTop: -theme.sizes.centerActionRise,
              backgroundColor: pressed ? theme.colors.primaryPressed : theme.colors.primary,
            },
            theme.elevation(1),
          ]}
        >
          <AppIcon name="add" size="centerAction" color="onPrimary" />
        </FocusablePressable>
      </View>
      {renderTab('profile')}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[0.5] },
  addSlot: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  add: { alignItems: 'center', justifyContent: 'center' },
});
