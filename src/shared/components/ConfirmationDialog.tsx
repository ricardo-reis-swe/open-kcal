import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/shared/theme';

import { AppText } from './AppText';
import { FocusablePressable } from './FocusablePressable';

export type ConfirmationDialogProps = {
  visible: boolean;
  title: string;
  body?: string;
  /** Explicit verb, never `Yes` (DS-09), e.g. `Delete entry`. */
  confirmLabel: string;
  cancelLabel: string;
  /** Destructive confirms use the danger color, visually distinct from cancel (NAV-08). */
  destructive?: boolean;
  onConfirm: () => void;
  /** Backdrop tap, system back and Cancel share this path (ARCH-06). */
  onCancel: () => void;
  testID?: string;
};

/** Short confirmation with two actions (DS-09, UX-19). */
export function ConfirmationDialog({
  visible,
  title,
  body,
  confirmLabel,
  cancelLabel,
  destructive = false,
  onConfirm,
  onCancel,
  testID,
}: ConfirmationDialogProps) {
  const theme = useTheme();
  if (!visible) return null;
  const actionStyle = ({ pressed }: { pressed: boolean }) => [
    styles.action,
    {
      minHeight: theme.touchMin,
      paddingHorizontal: theme.spacing[3],
      borderRadius: theme.radii.small,
    },
    pressed && { backgroundColor: destructive ? theme.colors.dangerTint : theme.colors.primaryTint },
  ];
  return (
    <Modal
      testID={testID ? `${testID}-modal` : undefined}
      transparent
      visible
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      <View style={[styles.center, { backgroundColor: theme.colors.scrim, padding: theme.spacing[6] }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} accessible={false} />
        <View
          testID={testID}
          accessibilityViewIsModal
          onAccessibilityEscape={onCancel}
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.surface,
              borderRadius: theme.radii.large,
              padding: theme.spacing[6],
              gap: theme.spacing[3],
            },
            theme.elevation(2),
          ]}
        >
          <AppText variant="sectionTitle" accessibilityRole="header">
            {title}
          </AppText>
          {body ? (
            <AppText variant="body" color="textSecondary">
              {body}
            </AppText>
          ) : null}
          <View style={[styles.actions, { gap: theme.spacing[2], marginTop: theme.spacing[2] }]}>
            <FocusablePressable
              onPress={onCancel}
              accessibilityRole="button"
              accessibilityLabel={cancelLabel}
              style={actionStyle}
            >
              <AppText variant="compactStrong" color="textPrimary">
                {cancelLabel}
              </AppText>
            </FocusablePressable>
            <FocusablePressable
              onPress={onConfirm}
              accessibilityRole="button"
              accessibilityLabel={confirmLabel}
              style={actionStyle}
            >
              <AppText variant="compactStrong" color={destructive ? 'danger' : 'primary'}>
                {confirmLabel}
              </AppText>
            </FocusablePressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { width: '100%', maxWidth: 400 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap' },
  action: { alignItems: 'center', justifyContent: 'center' },
});
