import { router } from 'expo-router';

import { DashboardNutrientsScreen } from '@/features/profile/screens/DashboardNutrientsScreen';

/** NAV-06 / UX-21 Dashboard nutrients: each change saves immediately; back → Profile. */
export default function DashboardNutrientsRoute() {
  return <DashboardNutrientsScreen onBack={() => router.back()} />;
}
