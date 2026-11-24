import { setStringAsync } from 'expo-clipboard';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { initializeApp } from '@/bootstrap/initialize-app';
import { AppProviders } from '@/bootstrap/providers';
import { startServices } from '@/bootstrap/start-services';
import { StartupGate, type StartupGateProps } from '@/bootstrap/StartupGate';
import { ThemePreferenceSync } from '@/bootstrap/ThemePreferenceSync';
import { getAppVersion } from '@/shared/config/env';

initializeApp();

// UX-20 Copy diagnostic info (versions + error category only).
const copyText = (text: string) => void setStringAsync(text);

/** The root tree with an injectable `start`, so navigation tests can run on a temp-dir database (ARCH-25). */
export function RootLayoutView({ start }: { start: StartupGateProps['start'] }) {
  return (
    <AppProviders>
      <StartupGate start={start} appVersion={getAppVersion()} copyText={copyText}>
        <ThemePreferenceSync />
        {/* Light content: the app bar is green in light mode and dark surface in dark mode (DS-07). */}
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
        </Stack>
      </StartupGate>
    </AppProviders>
  );
}

export default function RootLayout() {
  return <RootLayoutView start={startServices} />;
}
