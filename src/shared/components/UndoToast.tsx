import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { useReducedMotion } from '@/shared/hooks/useReducedMotion';
import { useTheme } from '@/shared/theme';

import { AppText } from './AppText';
import { FocusablePressable } from './FocusablePressable';

const MIN_DISMISS_DISTANCE = 64;
const EXIT_MS = 180;
const SETTLE_MS = 160;

/** DS-10: a released toast swipe dismisses on a fling or past ~35% of the toast width, otherwise springs back. */
export const shouldDismissToast = (dx: number, velocityX: number, width: number) => {
  'worklet';
  if (Math.abs(velocityX) > 800 && Math.sign(velocityX) === Math.sign(dx)) return true;
  return Math.abs(dx) >= Math.max(MIN_DISMISS_DISTANCE, width * 0.35);
};

export type UndoToastProps = {
  message: string;
  /** Omit both for a plain transient message (e.g. copy confirmation or a failure). */
  undoLabel?: string;
  onUndo?: () => void;
  onDismiss: () => void;
  durationMs?: number;
  /** `${testID}` = toast, `${testID}-pan` = swipe-to-dismiss gesture. */
  testID?: string;
};

/**
 * Temporary bottom snackbar (DS-10): Undo after an immediately committed delete, or a result that isn't visible.
 * A horizontal swipe dismisses it like a timeout (never Undo); the timer pauses while it is held.
 */
export function UndoToast({ message, undoLabel, onUndo, onDismiss, durationMs = 5_000, testID }: UndoToastProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(1);
  const width = useSharedValue(0);
  // Held = a swipe is in progress: the timer pauses, and releasing back into place starts a fresh one (DS-10).
  const [held, setHeld] = useState(false);
  const [releases, setReleases] = useState(0);
  const release = () => {
    setHeld(false);
    setReleases((count) => count + 1);
  };
  const dismissRef = useRef(onDismiss);
  useEffect(() => {
    dismissRef.current = onDismiss;
  }, [onDismiss]);
  useEffect(() => {
    if (held) return;
    const timer = setTimeout(() => dismissRef.current(), durationMs);
    return () => clearTimeout(timer);
  }, [durationMs, held, message, releases]);

  const pan = Gesture.Pan()
    .withTestId(`${testID ?? 'toast'}-pan`)
    .activeOffsetX([-10, 10])
    .failOffsetY([-10, 10])
    .onStart(() => {
      scheduleOnRN(setHeld, true);
    })
    .onUpdate((event) => {
      translateX.set(event.translationX);
    })
    // Runs for every activated swipe, cancelled ones too, so the timer always resumes or the toast leaves.
    .onEnd((event) => {
      if (!shouldDismissToast(translateX.get(), event.velocityX, width.get())) {
        translateX.set(withTiming(0, { duration: SETTLE_MS }));
        scheduleOnRN(release);
        return;
      }
      const onDone = (finished?: boolean) => {
        'worklet';
        if (finished) scheduleOnRN(onDismiss);
      };
      // DS-10 reduced motion: fade out where it was released instead of sliding off-screen.
      if (reduceMotion) opacity.set(withTiming(0, { duration: EXIT_MS }, onDone));
      else {
        const exit = Math.sign(translateX.get() || 1) * Math.max(width.get(), 400);
        translateX.set(withTiming(exit, { duration: EXIT_MS }, onDone));
      }
    });
  const animatedToast = useAnimatedStyle(() => {
    const progress = Math.min(1, Math.abs(translateX.get()) / Math.max(width.get(), 1));
    return { transform: [{ translateX: translateX.get() }], opacity: opacity.get() * (1 - progress * 0.6) };
  });

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        accessibilityActions={[{ name: 'escape' }, { name: 'dismiss', label: t('common.close') }]}
        onAccessibilityAction={({ nativeEvent }) => {
          if (nativeEvent.actionName === 'escape' || nativeEvent.actionName === 'dismiss') onDismiss();
        }}
        onAccessibilityEscape={onDismiss}
        onLayout={(event) => width.set(event.nativeEvent.layout.width)}
        testID={testID}
        style={[
          styles.toast,
          {
            left: theme.spacing[4],
            right: theme.spacing[4],
            bottom: theme.spacing[4],
            minHeight: theme.touchMin,
            paddingLeft: theme.spacing[4],
            paddingRight: onUndo ? theme.spacing[1] : theme.spacing[4],
            paddingVertical: onUndo ? 0 : theme.spacing[2],
            borderRadius: theme.radii.medium,
            backgroundColor: theme.colors.textPrimary,
          },
          theme.elevation(2),
          animatedToast,
        ]}
      >
        <AppText variant="compact" style={{ flex: 1, color: theme.colors.canvas }}>
          {message}
        </AppText>
        {onUndo && undoLabel ? (
          <FocusablePressable
            accessibilityRole="button"
            accessibilityLabel={undoLabel}
            onPress={onUndo}
            style={({ pressed }) => [
              styles.action,
              {
                minHeight: theme.touchMin,
                paddingHorizontal: theme.spacing[3],
                borderRadius: theme.radii.small,
                backgroundColor: pressed ? 'rgba(255,255,255,0.14)' : 'transparent',
              },
            ]}
          >
            <AppText variant="compactStrong" style={{ color: theme.colors.canvas }}>
              {undoLabel}
            </AppText>
          </FocusablePressable>
        ) : null}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  toast: { position: 'absolute', zIndex: 10, flexDirection: 'row', alignItems: 'center' },
  action: { alignItems: 'center', justifyContent: 'center' },
});
