import { router } from 'expo-router';

import { ThemeScreen } from '@/features/profile/screens/ThemeScreen';

/** NAV-06 / UX-23 Theme: each change saves immediately; back → Profile. */
export default function ThemeRoute() {
  return <ThemeScreen onBack={() => router.back()} />;
}
