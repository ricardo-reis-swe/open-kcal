import { Stack } from 'expo-router';

// NAV-02: the Profile tab keeps its own stack. A push from another tab with `withAnchor` (the Diary's `Set goals`,
// UX-01) puts the hub underneath, so back and NAV-06 "Save → Profile" land on Profile.
export const unstable_settings = { initialRouteName: 'index' };

export default function ProfileStackLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
