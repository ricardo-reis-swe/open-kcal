import { useTranslation } from 'react-i18next';
import { StyleSheet, Switch, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { type SharedValue, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { dragShift, dropIndex, dropTarget } from '@/domain/meals/meals';
import { AppIcon, AppText } from '@/shared/components';
import { useTheme } from '@/shared/theme';

/** Shared drag state for one reorderable list (only one row drags at a time). */
export type ReorderDragState = {
  active: SharedValue<number>;
  hover: SharedValue<number>;
  rowHeight: SharedValue<number>;
};

export function useReorderDragState(): ReorderDragState {
  const theme = useTheme();
  return {
    active: useSharedValue(-1),
    hover: useSharedValue(-1),
    rowHeight: useSharedValue<number>(theme.sizes.settingsRow[0]),
  };
}

export type ReorderableSwitchRowProps = {
  label: string;
  index: number;
  count: number;
  drag: ReorderDragState;
  value: boolean;
  disabled?: boolean;
  hint?: string;
  onToggle: (value: boolean) => void;
  onMove: (delta: -1 | 1) => void;
  onDrop: (toIndex: number) => void;
  /** testIDs: `${prefix}-row-${rowKey}`, `${prefix}-switch-${rowKey}`, `${prefix}-handle-${index}` (+ `-pan-`). */
  testIDPrefix: string;
  rowKey: string;
};

/**
 * Settings row with a switch and a drag handle (UX-17 reorder: handle drag commits on drop; a11y `Move up` /
 * `Move down` on the row). Used by UX-18 `Search results` and UX-21 Dashboard nutrients.
 */
export function ReorderableSwitchRow({
  label,
  index,
  count,
  drag,
  value,
  disabled = false,
  hint,
  onToggle,
  onMove,
  onDrop,
  testIDPrefix,
  rowKey,
}: ReorderableSwitchRowProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const dragY = useSharedValue(0);
  const height = useSharedValue<number>(theme.sizes.settingsRow[0]);

  const pan = Gesture.Pan()
    .withTestId(`${testIDPrefix}-handle-pan-${index}`)
    .minDistance(4)
    .onStart(() => {
      drag.rowHeight.set(height.get());
      drag.hover.set(index);
      drag.active.set(index);
    })
    .onUpdate((event) => {
      dragY.set(event.translationY);
      drag.hover.set(dropIndex(index, event.translationY, height.get(), count));
    })
    // As UX-17 Meals: commit on finalize so a release outside the list still drops on the last previewed slot.
    .onFinalize(() => {
      const to = drag.active.get() === index ? dropTarget(index, drag.hover.get(), count) : null;
      if (to !== null) scheduleOnRN(onDrop, to);
      drag.active.set(-1);
      drag.hover.set(-1);
      dragY.set(0);
    });

  const style = useAnimatedStyle(() => {
    const active = drag.active.get();
    const isDragged = active === index;
    const shift = dragShift(index, active, drag.hover.get(), drag.rowHeight.get());
    return {
      transform: [{ translateY: isDragged ? dragY.get() : active < 0 ? 0 : withTiming(shift, { duration: 150 }) }],
      zIndex: isDragged ? 1 : 0,
      opacity: isDragged ? 0.9 : 1,
    };
  });

  const actions = [
    ...(index > 0 ? [{ name: 'moveUp', label: t('meals.moveUp') }] : []),
    ...(index < count - 1 ? [{ name: 'moveDown', label: t('meals.moveDown') }] : []),
  ];

  return (
    <Animated.View style={style} onLayout={(event) => height.set(event.nativeEvent.layout.height)}>
      <View
        style={[
          styles.row,
          {
            minHeight: theme.sizes.settingsRow[0],
            backgroundColor: theme.colors.surface,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: theme.colors.divider,
          },
        ]}
      >
        <View
          accessible
          accessibilityLabel={label}
          accessibilityActions={actions}
          onAccessibilityAction={(event) => {
            if (event.nativeEvent.actionName === 'moveUp') onMove(-1);
            if (event.nativeEvent.actionName === 'moveDown') onMove(1);
          }}
          testID={`${testIDPrefix}-row-${rowKey}`}
          style={[styles.label, { paddingLeft: theme.spacing[4] }]}
        >
          <AppText variant="body">{label}</AppText>
        </View>
        <Switch
          value={value}
          disabled={disabled}
          onValueChange={onToggle}
          accessibilityLabel={label}
          accessibilityHint={hint}
          trackColor={{ true: theme.colors.primary, false: theme.colors.divider }}
          testID={`${testIDPrefix}-switch-${rowKey}`}
        />
        {/* Touch affordance only; screen readers reorder via the row's move actions. */}
        <GestureDetector gesture={pan}>
          <View
            testID={`${testIDPrefix}-handle-${index}`}
            style={[styles.handle, { minWidth: theme.touchMin, minHeight: theme.touchMin }]}
          >
            <AppIcon name="reorder-three-outline" color="textSecondary" />
          </View>
        </GestureDetector>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  label: { flex: 1, justifyContent: 'center' },
  handle: { alignItems: 'center', justifyContent: 'center' },
});
