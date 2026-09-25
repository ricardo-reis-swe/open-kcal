import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { initializeApp } from '@/bootstrap/initialize-app';
import { AppProviders } from '@/bootstrap/providers';

initializeApp();

export default function RootLayout() {
  return (
    <AppProviders>
      {/* Light content: the app bar is green in light mode and dark surface in dark mode (DS-07). */}
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </AppProviders>
  );
}
