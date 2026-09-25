import { Stack } from 'expo-router';

// NAV-02: the Profile tab keeps its own stack.
export default function ProfileStackLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
