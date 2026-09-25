import { forwardRef, useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/shared/theme';

import { AppIcon } from './AppIcon';
import { AppText } from './AppText';

export type FormFieldProps = Omit<TextInputProps, 'style' | 'editable'> & {
  label: string;
  /** Shown directly below the field with an icon, until fixed (DS-09, UX-00). */
  error?: string;
  helper?: string;
  /** Unit shown adjacent to the value and included in the accessible label (DS-04). */
  unit?: string;
  disabled?: boolean;
};

/** Label above, ~48 input on `surfaceSubtle`, never inside a card (DS-09). */
export const FormField = forwardRef<TextInput, FormFieldProps>(function FormField(
  { label, error, helper, unit, disabled = false, onFocus, onBlur, testID, ...inputProps },
  ref,
) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [focused, setFocused] = useState(false);
  const borderColor = error ? theme.colors.danger : focused ? theme.colors.focus : theme.colors.borderStrong;
  const accessibleLabel = unit ? t('a11y.labelWithValue', { label, value: unit }) : label;

  return (
    <View style={{ gap: theme.spacing[1] }}>
      <AppText variant="label" color="textSecondary" accessible={false} importantForAccessibility="no">
        {label}
      </AppText>
      <View
        style={[
          styles.inputRow,
          {
            minHeight: theme.sizes.input,
            borderRadius: theme.radii.medium,
            backgroundColor: theme.colors.surfaceSubtle,
            borderColor,
            borderWidth: focused || error ? theme.sizes.focusRing : 1,
            paddingHorizontal: theme.spacing[3],
          },
        ]}
      >
        <TextInput
          ref={ref}
          {...inputProps}
          testID={testID}
          editable={!disabled}
          accessibilityLabel={accessibleLabel}
          accessibilityHint={error ?? helper}
          accessibilityState={{ disabled }}
          placeholderTextColor={theme.colors.textSecondary}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[
            styles.input,
            {
              color: disabled ? theme.colors.textSecondary : theme.colors.textPrimary,
              fontSize: theme.typography.body.fontSize,
              paddingVertical: theme.spacing[2],
            },
          ]}
        />
        {unit ? (
          <AppText variant="compact" color="textSecondary" accessible={false} importantForAccessibility="no">
            {unit}
          </AppText>
        ) : null}
      </View>
      {error ? (
        <View
          style={[styles.message, { gap: theme.spacing[1] }]}
          accessible
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          <AppIcon name="alert-circle-outline" size="inline" color="danger" />
          <AppText variant="compact" color="danger" style={styles.messageText}>
            {error}
          </AppText>
        </View>
      ) : helper ? (
        <AppText variant="compact" color="textSecondary">
          {helper}
        </AppText>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { flex: 1 },
  message: { flexDirection: 'row', alignItems: 'flex-start' },
  messageText: { flex: 1 },
});
