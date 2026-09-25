import { useEffect, useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { useReducedMotion } from '@/shared/hooks/useReducedMotion';
import { useTheme } from '@/shared/theme';

export type BottomSheetProps = {
  visible: boolean;
  /** The single cancel path: backdrop tap, swipe down, system back and the a11y escape all call it (ARCH-06). */
  onClose: () => void;
  /** Screen-reader name for the sheet, e.g. `Add`. */
  accessibilityLabel: string;
  /** Label for the backdrop's close action, e.g. `Close`. */
  closeLabel: string;
  children: ReactNode;
  testID?: string;
};

const DISMISS_DISTANCE = 80;
const DISMISS_VELOCITY = 800;

/**
 * The app's only sheet (ARCH-06). Content-sized (smallest snap height), 4×36 handle, no title (DS-09).
 * Reduced motion swaps the slide for a fade (DS-10).
 */
export function BottomSheet({ visible, onClose, accessibilityLabel, closeLabel, children, testID }: BottomSheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const [mounted, setMounted] = useState(visible);
  const progress = useSharedValue(0); // 0 hidden → 1 shown
  const dragY = useSharedValue(0);
  const duration = theme.motionMs.sheet[0];

  // Mount as soon as it opens; unmount only after the close animation finishes.
  if (visible && !mounted) setMounted(true);

  useEffect(() => {
    if (visible) {
      dragY.set(0);
      progress.set(withTiming(1, { duration }));
    } else {
      progress.set(
        withTiming(0, { duration }, (finished) => {
          if (finished) scheduleOnRN(setMounted, false);
        }),
      );
    }
  }, [visible, duration, progress, dragY]);

  const pan = Gesture.Pan()
    .onUpdate((event) => {
      dragY.set(Math.max(0, event.translationY));
    })
    .onEnd((event) => {
      if (event.translationY > DISMISS_DISTANCE || event.velocityY > DISMISS_VELOCITY) {
        scheduleOnRN(onClose);
      } else {
        dragY.set(withTiming(0, { duration: theme.motionMs.press[1] }));
      }
    });

  const scrimStyle = useAnimatedStyle(() => ({ opacity: progress.get() }));
  const sheetStyle = useAnimatedStyle(() =>
    reduceMotion
      ? { opacity: progress.get(), transform: [{ translateY: dragY.get() }] }
      : { transform: [{ translateY: (1 - progress.get()) * windowHeight * 0.6 + dragY.get() }] },
  );

  if (!mounted) return null;

  return (
    <Modal
      testID={testID ? `${testID}-modal` : undefined}
      transparent
      visible
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={styles.fill}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.scrim }, scrimStyle]}>
          <Pressable
            style={styles.fill}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={closeLabel}
            testID={testID ? `${testID}-backdrop` : undefined}
          />
        </Animated.View>
        <View style={styles.bottom} pointerEvents="box-none">
          <Animated.View
            testID={testID}
            accessibilityViewIsModal
            accessibilityLabel={accessibilityLabel}
            onAccessibilityEscape={onClose}
            style={[
              {
                backgroundColor: theme.colors.surface,
                borderTopLeftRadius: theme.radii.large,
                borderTopRightRadius: theme.radii.large,
                paddingBottom: insets.bottom + theme.spacing[2],
                maxHeight: windowHeight - insets.top - theme.spacing[6],
              },
              theme.elevation(2),
              sheetStyle,
            ]}
          >
            <GestureDetector gesture={pan}>
              <View style={[styles.handleArea, { paddingVertical: theme.spacing[2] }]} accessible={false}>
                <View
                  style={{
                    width: theme.sizes.sheetHandle.width,
                    height: theme.sizes.sheetHandle.height,
                    borderRadius: theme.sizes.sheetHandle.height / 2,
                    backgroundColor: theme.colors.borderStrong,
                  }}
                />
              </View>
            </GestureDetector>
            {children}
          </Animated.View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  bottom: { flex: 1, justifyContent: 'flex-end' },
  handleArea: { alignItems: 'center' },
});
