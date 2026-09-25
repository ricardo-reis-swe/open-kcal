import { Tabs } from 'expo-router/tabs';
import { useState } from 'react';

import { AddActionSheet } from '@/shared/navigation/AddActionSheet';
import { AppTabBar } from '@/shared/navigation/AppTabBar';

// ARCH-06 / NAV-02: Diary + Profile are tab routes; `+` is a custom button that opens the Add Action Sheet.
export default function TabsLayout() {
  const [addOpen, setAddOpen] = useState(false);
  return (
    <>
      <Tabs
        screenOptions={{ headerShown: false }}
        tabBar={(props) => <AppTabBar {...props} onAddPress={() => setAddOpen(true)} />}
      >
        <Tabs.Screen name="diary" />
        <Tabs.Screen name="profile" />
      </Tabs>
      <AddActionSheet visible={addOpen} onClose={() => setAddOpen(false)} />
    </>
  );
}
