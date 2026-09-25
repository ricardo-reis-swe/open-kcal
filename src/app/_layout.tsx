import { setStringAsync } from 'expo-clipboard';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { initializeApp } from '@/bootstrap/initialize-app';
import { AppProviders } from '@/bootstrap/providers';
import { startServices } from '@/bootstrap/start-services';
import { StartupGate } from '@/bootstrap/StartupGate';

const { config } = initializeApp();

// UX-20 Copy diagnostic info (versions + error category only).
const copyText = (text: string) => void setStringAsync(text);

export default function RootLayout() {
  return (
    <AppProviders>
      <StartupGate start={startServices} appVersion={config.appVersion} copyText={copyText}>
        {/* Light content: the app bar is green in light mode and dark surface in dark mode (DS-07). */}
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
        </Stack>
      </StartupGate>
    </AppProviders>
  );
}
