import { Tabs } from 'expo-router/tabs';
import { useState } from 'react';

import { GlobalAddFlow } from '@/features/diary/components/GlobalAddFlow';
import { DiaryDateProvider } from '@/features/diary/hooks/DiaryDateContext';
import { WeightEntryProvider } from '@/features/profile/hooks/WeightEntryContext';
import { AppTabBar } from '@/shared/navigation/AppTabBar';

// ARCH-06 / NAV-02: Diary + Profile are tab routes; `+` is a custom button that opens the Add Action Sheet.
// NAV-03/05: the selected diary date sits above both tabs, so `+` from Profile also uses it.
// NAV-07: the Weight Entry Sheet is app-level too (from `+`, Profile and Weight History).
export default function TabsLayout() {
  const [addOpen, setAddOpen] = useState(false);
  return (
    <DiaryDateProvider>
      <WeightEntryProvider>
        <Tabs
          screenOptions={{ headerShown: false, tabBarHideOnKeyboard: true }}
          tabBar={(props) => <AppTabBar {...props} onAddPress={() => setAddOpen(true)} />}
        >
          <Tabs.Screen name="diary" />
          <Tabs.Screen name="profile" />
        </Tabs>
        <GlobalAddFlow open={addOpen} onClose={() => setAddOpen(false)} />
      </WeightEntryProvider>
    </DiaryDateProvider>
  );
}
