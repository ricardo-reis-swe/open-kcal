import { render, type RenderOptions } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { i18next, initI18n } from '@/shared/i18n/i18n';
import type { AppLanguage } from '@/shared/i18n/locale';
import { ThemeProvider, type ColorScheme } from '@/shared/theme';

// Component tests run in `en`; one pt-PT smoke test per screen (ARCH-22).
export type ProviderOptions = { scheme?: ColorScheme; language?: AppLanguage };

const TEST_METRICS = {
  frame: { x: 0, y: 0, width: 375, height: 667 },
  insets: { top: 20, left: 0, right: 0, bottom: 0 },
};

export function TestProviders({
  children,
  scheme = 'light',
  language = 'en',
}: ProviderOptions & { children: ReactNode }) {
  initI18n({ language, formattingLocale: language, regionCode: language === 'pt-PT' ? 'PT' : 'US' });
  return (
    <SafeAreaProvider initialMetrics={TEST_METRICS}>
      <I18nextProvider i18n={i18next}>
        <ThemeProvider scheme={scheme}>{children}</ThemeProvider>
      </I18nextProvider>
    </SafeAreaProvider>
  );
}

export function renderWithProviders(ui: ReactElement, options: ProviderOptions & RenderOptions = {}) {
  const { scheme, language, ...renderOptions } = options;
  return render(
    <TestProviders scheme={scheme} language={language}>
      {ui}
    </TestProviders>,
    renderOptions,
  );
}
