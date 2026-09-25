import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { initializeApp } from '@/bootstrap/initialize-app';
import { AppProviders } from '@/bootstrap/providers';
import { startServices } from '@/bootstrap/start-services';
import { StartupGate } from '@/bootstrap/StartupGate';

const { config } = initializeApp();

export default function RootLayout() {
  return (
    <AppProviders>
      <StartupGate start={startServices} appVersion={config.appVersion}>
        {/* Light content: the app bar is green in light mode and dark surface in dark mode (DS-07). */}
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
        </Stack>
      </StartupGate>
    </AppProviders>
  );
}
