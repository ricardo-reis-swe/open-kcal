import { Stack } from 'expo-router';

import { DiaryDateProvider } from '@/features/diary/hooks/DiaryDateContext';

// NAV-02: the Diary tab keeps its own stack. NAV-05: the selected date is owned above the stack.
export default function DiaryStackLayout() {
  return (
    <DiaryDateProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </DiaryDateProvider>
  );
}
