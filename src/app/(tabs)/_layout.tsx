import { Tabs } from 'expo-router/tabs';
import { useState } from 'react';

import { GlobalAddFlow } from '@/features/diary/components/GlobalAddFlow';
import { DiaryDateProvider } from '@/features/diary/hooks/DiaryDateContext';
import { AppTabBar } from '@/shared/navigation/AppTabBar';

// ARCH-06 / NAV-02: Diary + Profile are tab routes; `+` is a custom button that opens the Add Action Sheet.
// NAV-03/05: the selected diary date sits above both tabs, so `+` from Profile also uses it.
export default function TabsLayout() {
  const [addOpen, setAddOpen] = useState(false);
  return (
    <DiaryDateProvider>
      <Tabs
        screenOptions={{ headerShown: false }}
        tabBar={(props) => <AppTabBar {...props} onAddPress={() => setAddOpen(true)} />}
      >
        <Tabs.Screen name="diary" />
        <Tabs.Screen name="profile" />
      </Tabs>
      <GlobalAddFlow open={addOpen} onClose={() => setAddOpen(false)} />
    </DiaryDateProvider>
  );
}
