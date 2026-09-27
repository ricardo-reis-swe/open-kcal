import { DefaultTheme, ThemeProvider as NavigationThemeProvider } from 'expo-router';
import type { ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { i18next } from '@/shared/i18n/i18n';
import { useSyncAppLocale } from '@/shared/i18n/useSyncAppLocale';
import { ThemeProvider, useTheme } from '@/shared/theme';

/** Keeps React Navigation's own colors (screen backgrounds, transitions) on our tokens. */
function NavigationTheme({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const base = DefaultTheme;
  return (
    <NavigationThemeProvider
      value={{
        ...base,
        colors: {
          ...base.colors,
          primary: theme.colors.primary,
          background: theme.colors.canvas,
          card: theme.colors.surface,
          text: theme.colors.textPrimary,
          border: theme.colors.divider,
          notification: theme.colors.danger,
        },
      }}
    >
      {children}
    </NavigationThemeProvider>
  );
}

/** App-wide providers (ARCH-17 order: … → providers + Router). Services/DB/Query mount inside `StartupGate`. */
export function AppProviders({ children }: { children: ReactNode }) {
  useSyncAppLocale();
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <I18nextProvider i18n={i18next}>
          <ThemeProvider>
            <NavigationTheme>{children}</NavigationTheme>
          </ThemeProvider>
        </I18nextProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
