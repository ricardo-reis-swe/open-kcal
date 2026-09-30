import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { useTheme } from '@/shared/theme';

import { AppIcon } from './AppIcon';
import { AppText } from './AppText';
import { FocusablePressable } from './FocusablePressable';

export const DELETE_ACTION_WIDTH = 88;
const EXIT_OFFSET = 500;
const SETTLE_MS = 160;

/** DS-08: where a released swipe settles; a fling wins over position, otherwise past half the action opens it. */
export const shouldOpenDeleteAction = (dx: number, velocityX: number) => {
  'worklet';
  if (velocityX < -500) return true;
  if (velocityX > 500) return false;
  return dx <= -DELETE_ACTION_WIDTH / 2;
};

export type SwipeToDeleteProps = {
  /** `${testID}` = moving row, `${testID}-pan` = gesture, `${testID}-delete` = revealed button. */
  testID: string;
  /** Visible label of the revealed button (e.g. `Delete`). */
  label: string;
  /** Tap on the revealed button. Resolving `false` (the delete failed) closes the row again. */
  onDelete?: () => Promise<boolean> | void;
  children: ReactNode;
};

/**
 * DS-08 swipe-to-reveal delete: a left swipe opens a danger `Delete` button at the row's trailing edge; tapping it
 * deletes (the caller shows Undo). A short swipe, a right swipe or a tap on the open row closes it again.
 */
export function SwipeToDelete({ testID, label, onDelete, children }: SwipeToDeleteProps) {
  const theme = useTheme();
  const translateX = useSharedValue(0);
  const start = useSharedValue(0);
  const [open, setOpen] = useState(false);
  const close = () => {
    translateX.set(withTiming(0, { duration: SETTLE_MS }));
    setOpen(false);
  };
  const commitDelete = () => {
    void Promise.resolve(onDelete?.()).then((deleted) => {
      if (deleted === false) close();
    });
  };
  const pressDelete = () =>
    translateX.set(
      withTiming(-EXIT_OFFSET, { duration: 180 }, (finished) => {
        if (finished) scheduleOnRN(commitDelete);
      }),
    );
  const pan = Gesture.Pan()
    .withTestId(`${testID}-pan`)
    .enabled(Boolean(onDelete))
    .activeOffsetX([-10, 10])
    .failOffsetY([-10, 10])
    .onStart(() => {
      start.set(translateX.get());
    })
    .onUpdate((event) => {
      translateX.set(Math.max(-DELETE_ACTION_WIDTH, Math.min(0, start.get() + event.translationX)));
    })
    .onFinalize((event) => {
      const opened = shouldOpenDeleteAction(translateX.get(), event.velocityX);
      translateX.set(withTiming(opened ? -DELETE_ACTION_WIDTH : 0, { duration: SETTLE_MS }));
      scheduleOnRN(setOpen, opened);
    });
  const animatedRow = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.get() }] }));
  if (!onDelete) return <View>{children}</View>;
  return (
    <View style={[styles.frame, { backgroundColor: theme.colors.danger }]}>
      <FocusablePressable
        testID={`${testID}-delete`}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityElementsHidden={!open}
        importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
        disabled={!open}
        onPress={pressDelete}
        style={[styles.action, { gap: theme.spacing[1] }]}
      >
        <AppIcon name="trash-outline" color="onPrimary" />
        <AppText variant="compact" color="onPrimary" numberOfLines={1}>
          {label}
        </AppText>
      </FocusablePressable>
      <GestureDetector gesture={pan}>
        <Animated.View testID={testID} style={animatedRow}>
          {children}
          {open ? (
            // An open row's tap closes it instead of opening the row's own action.
            <Pressable testID={`${testID}-close`} style={StyleSheet.absoluteFill} onPress={close} accessible={false} />
          ) : null}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden' },
  action: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: DELETE_ACTION_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
