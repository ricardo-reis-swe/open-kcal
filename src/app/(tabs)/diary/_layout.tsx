import { Stack } from 'expo-router';

// NAV-02: the Diary tab keeps its own stack. NAV-05: the selected date is owned above it (tabs layout).
export default function DiaryStackLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
