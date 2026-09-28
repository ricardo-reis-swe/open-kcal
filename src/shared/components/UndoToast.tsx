import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/shared/theme';

import { AppText } from './AppText';
import { FocusablePressable } from './FocusablePressable';

export type UndoToastProps = {
  message: string;
  undoLabel: string;
  onUndo: () => void;
  onDismiss: () => void;
  durationMs?: number;
  testID?: string;
};

/** Temporary bottom snackbar for immediately committed, reversible actions (DS-10). */
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
          paddingRight: theme.spacing[1],
          borderRadius: theme.radii.medium,
          backgroundColor: theme.colors.textPrimary,
        },
        theme.elevation(2),
      ]}
    >
      <AppText variant="compact" style={{ flex: 1, color: theme.colors.canvas }}>
        {message}
      </AppText>
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
    </View>
  );
}

const styles = StyleSheet.create({
  toast: { position: 'absolute', zIndex: 10, flexDirection: 'row', alignItems: 'center' },
  action: { alignItems: 'center', justifyContent: 'center' },
});
