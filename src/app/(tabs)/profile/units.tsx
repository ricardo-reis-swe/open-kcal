import { router } from 'expo-router';

import { UnitsScreen } from '@/features/profile/screens/UnitsScreen';

/** NAV-06 / UX-18 Units: each change saves immediately; back → Profile. */
export default function UnitsRoute() {
  return <UnitsScreen onBack={() => router.back()} />;
}
