import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/shared/theme';

import { AppText } from './AppText';
import { FocusablePressable } from './FocusablePressable';

export type UndoToastProps = {
  message: string;
  /** Omit both for a plain transient message (e.g. copy confirmation or a failure). */
  undoLabel?: string;
  onUndo?: () => void;
  onDismiss: () => void;
  durationMs?: number;
  testID?: string;
};

/** Temporary bottom snackbar (DS-10): Undo after an immediately committed delete, or a result that isn't visible. */
export function UndoToast({ message, undoLabel, onUndo, onDismiss, durationMs = 5_000, testID }: UndoToastProps) {
  const theme = useTheme();
  const dismissRef = useRef(onDismiss);
  useEffect(() => {
    dismissRef.current = onDismiss;
  }, [onDismiss]);
  useEffect(() => {
    const timer = setTimeout(() => dismissRef.current(), durationMs);
    return () => clearTimeout(timer);
  }, [durationMs, message]);

  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
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
    </View>
  );
}

const styles = StyleSheet.create({
  toast: { position: 'absolute', zIndex: 10, flexDirection: 'row', alignItems: 'center' },
  action: { alignItems: 'center', justifyContent: 'center' },
});
