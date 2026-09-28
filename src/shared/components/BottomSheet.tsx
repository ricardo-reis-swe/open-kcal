import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { useReducedMotion } from '@/shared/hooks/useReducedMotion';
import { useTheme } from '@/shared/theme';

import { FocusablePressable } from './FocusablePressable';

export type BottomSheetProps = {
  visible: boolean;
  /** The single cancel path: backdrop tap, swipe down, system back and the a11y escape all call it (ARCH-06). */
  onClose: () => void;
  /** Screen-reader name for the sheet, e.g. `Add`. */
  accessibilityLabel: string;
  /** Label for the backdrop's close action, e.g. `Close`. */
  closeLabel: string;
  /** Called once the close animation has finished and the sheet is gone, e.g. to open the next sheet (NAV-03). */
  onDismissed?: () => void;
  children: ReactNode;
  /** Sheets with a text field grow above the keyboard (UX-14). */
  avoidKeyboard?: boolean;
  testID?: string;
};

const DISMISS_DISTANCE_MAX = 80;
const DISMISS_DISTANCE_RATIO = 0.3;
const DISMISS_VELOCITY = 500;

/**
 * Swipe-down decision. The distance scales with the sheet so a short, content-sized sheet near the screen edge
 * (and the Android gesture-nav zone) can still be dragged far enough.
 */
export function shouldDismissSheet(translationY: number, velocityY: number, sheetHeight: number): boolean {
  'worklet';
  const distance =
    sheetHeight > 0 ? Math.min(DISMISS_DISTANCE_MAX, sheetHeight * DISMISS_DISTANCE_RATIO) : DISMISS_DISTANCE_MAX;
  return translationY > distance || velocityY > DISMISS_VELOCITY;
}

/** Vertical hitSlop that brings the handle (bar + vertical padding) up to the platform touch minimum (DS-02). */
export function sheetHandleSlop(touchMin: number, handleHeight: number, paddingVertical: number): number {
  return Math.max(0, (touchMin - (handleHeight + 2 * paddingVertical)) / 2);
}

/**
 * The app's only sheet (ARCH-06). Content-sized (smallest snap height), 4×36 handle, no title (DS-09).
 * Reduced motion swaps the slide for a fade (DS-10).
 */
export function BottomSheet({
  visible,
  onClose,
  onDismissed,
  accessibilityLabel,
  closeLabel,
  children,
  avoidKeyboard = false,
  testID,
}: BottomSheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const [mounted, setMounted] = useState(visible);
  const progress = useSharedValue(0); // 0 hidden → 1 shown
  const dragY = useSharedValue(0);
  const sheetHeight = useSharedValue(0);
  const duration = theme.motionMs.sheet[0];
  const handleSlop = sheetHandleSlop(theme.touchMin, theme.sizes.sheetHandle.height, theme.spacing[2]);

  const dismissedRef = useRef(onDismissed);
  useEffect(() => {
    dismissedRef.current = onDismissed;
  }, [onDismissed]);
  const shownRef = useRef(false);
  // Mount as soon as it opens; unmount only after the close animation finishes.
  if (visible && !mounted) setMounted(true);
  const finishClose = () => {
    setMounted(false);
    // Only a sheet that was actually shown reports a dismissal (not the initial hidden mount).
    if (!shownRef.current) return;
    shownRef.current = false;
    dismissedRef.current?.();
  };

  useEffect(() => {
    if (visible) {
      shownRef.current = true;
      dragY.set(0);
      progress.set(withTiming(1, { duration }));
    } else {
      progress.set(
        withTiming(0, { duration }, (finished) => {
          if (finished) scheduleOnRN(finishClose);
        }),
      );
    }
  }, [visible, duration, progress, dragY]);

  // DS-11: VoiceOver/TalkBack don't announce a modal container's label, so say the sheet's name on open.
  useEffect(() => {
    if (visible) AccessibilityInfo.announceForAccessibility(accessibilityLabel);
  }, [visible, accessibilityLabel]);

  // The whole sheet is the drag surface (handle + content). Sheets with scrolling content must coordinate this
  // pan with their scroll gesture (e.g. `simultaneousWithExternalGesture`) when they arrive.
  const pan = Gesture.Pan()
    .withTestId(testID ? `${testID}-pan` : 'bottom-sheet-pan')
    .activeOffsetY(8)
    .onUpdate((event) => {
      dragY.set(Math.max(0, event.translationY));
    })
    .onEnd((event) => {
      if (shouldDismissSheet(event.translationY, event.velocityY, sheetHeight.get())) {
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
            accessible={false}
            importantForAccessibility="no"
            testID={testID ? `${testID}-backdrop` : undefined}
          />
        </Animated.View>
        <KeyboardAvoidingView style={styles.bottom} pointerEvents="box-none" behavior="padding" enabled={avoidKeyboard}>
          <GestureDetector gesture={pan}>
            <Animated.View
              testID={testID}
              accessibilityViewIsModal
              accessibilityLabel={accessibilityLabel}
              onAccessibilityEscape={onClose}
              onLayout={(event) => sheetHeight.set(event.nativeEvent.layout.height)}
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
              {/* The handle is also the in-sheet close control for screen readers (the backdrop sits outside the
                  modal a11y container). hitSlop reaches the touch minimum without adding empty space (DS-02, DS-09). */}
              <FocusablePressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel={closeLabel}
                testID={testID ? `${testID}-handle` : undefined}
                hitSlop={{ top: handleSlop, bottom: handleSlop }}
                style={[styles.handleArea, { paddingVertical: theme.spacing[2] }]}
              >
                <View
                  style={{
                    width: theme.sizes.sheetHandle.width,
                    height: theme.sizes.sheetHandle.height,
                    borderRadius: theme.sizes.sheetHandle.height / 2,
                    backgroundColor: theme.colors.borderStrong,
                  }}
                />
              </FocusablePressable>
              {children}
            </Animated.View>
          </GestureDetector>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  bottom: { flex: 1, justifyContent: 'flex-end' },
  handleArea: { alignItems: 'center' },
});
