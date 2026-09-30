import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppBar, AppText, InlineStatus, TextAction } from '@/shared/components';
import { THEME_PREFERENCES, useTheme, type ThemePreference } from '@/shared/theme';

import { useSetThemePreference, useThemePreference } from '../profile.queries';

type Props = { onBack: () => void };

/** UX-23 Theme: one segmented control (System | Light | Dark); a choice saves and applies immediately, as Units. */
export function ThemeScreen({ onBack }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const preference = useThemePreference().data;
  const update = useSetThemePreference();
  const [saveFailed, setSaveFailed] = useState(false);

  const choose = async (next: ThemePreference) => {
    setSaveFailed(false);
    try {
      await update.mutateAsync(next);
    } catch {
      setSaveFailed(true);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.canvas }}>
      <AppBar title={t('theme.title')} back={{ label: t('common.back'), onPress: onBack }} />
      {preference ? (
        <ScrollView contentContainerStyle={{ padding: theme.spacing[4], gap: theme.spacing[2] }}>
          <View accessibilityRole="radiogroup" accessibilityLabel={t('theme.title')}>
            <View style={[styles.segments, { gap: theme.spacing[4] }]}>
              {THEME_PREFERENCES.map((option) => (
                <TextAction
                  key={option}
                  label={t(`theme.${option}`)}
                  selected={preference === option}
                  onPress={() => {
                    if (preference !== option) void choose(option);
                  }}
                  testID={`theme-${option}`}
                />
              ))}
            </View>
          </View>
          <AppText variant="compact" color="textSecondary">
            {t('theme.systemHint')}
          </AppText>
          {saveFailed ? <InlineStatus tone="error" message={t('units.saveError')} testID="theme-error" /> : null}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  segments: { flexDirection: 'row' },
});
