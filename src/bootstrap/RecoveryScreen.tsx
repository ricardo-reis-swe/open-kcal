// UX-20 / ARCH-13: safe recovery screen for a startup or migration failure. Retry + diagnostic guidance; never a
// reset. Diagnostic info holds versions and the error category only (ARCH-15).
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, PrimaryButton, TextAction } from '@/shared/components';
import type { AppError } from '@/shared/errors';
import { useTheme } from '@/shared/theme';

export type DiagnosticContext = { appVersion: string; schemaVersion: number };

export function diagnosticInfo(error: AppError, { appVersion, schemaVersion }: DiagnosticContext): string {
  const version = 'version' in error ? ` (v${Number(error.version)})` : '';
  return [
    `app ${appVersion}`,
    `schema ${schemaVersion}`,
    `${Platform.OS} ${String(Platform.Version)}`,
    `error ${error.category}${version}`,
  ].join(' · ');
}

export type RecoveryScreenProps = {
  error: AppError;
  diagnostics: DiagnosticContext;
  onRetry: () => void;
  retrying?: boolean;
  /** Clipboard writer (expo-clipboard in the app). */
  copyText: (text: string) => Promise<void> | void;
};

export function RecoveryScreen({ error, diagnostics, onRetry, retrying = false, copyText }: RecoveryScreenProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    // Scrolls so Retry stays reachable at the largest text sizes (DS-11: no clipping).
    <ScrollView
      testID="recovery-screen"
      style={[styles.root, { backgroundColor: theme.colors.canvas }]}
      contentContainerStyle={[
        {
          paddingTop: insets.top + theme.spacing[8],
          paddingBottom: insets.bottom + theme.spacing[6],
          paddingHorizontal: theme.spacing[6],
          gap: theme.spacing[4],
        },
      ]}
    >
      <StatusBar style="dark" />
      <AppText variant="screenTitle" accessibilityRole="header">
        {t('startup.title')}
      </AppText>
      <AppText color="textSecondary">{t('startup.body')}</AppText>
      <View style={{ gap: theme.spacing[2], alignItems: 'flex-start' }}>
        <PrimaryButton label={t('startup.retry')} onPress={onRetry} loading={retrying} testID="recovery-retry" />
        <TextAction
          label={t('startup.copyDiagnostics')}
          icon="copy-outline"
          onPress={() => void copyText(diagnosticInfo(error, diagnostics))}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
