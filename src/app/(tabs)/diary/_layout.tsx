import { Stack } from 'expo-router';

// NAV-02: the Diary tab keeps its own stack.
export default function DiaryStackLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
