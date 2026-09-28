import { router, useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useCallback } from 'react';

import { CaloriesMacrosScreen, type ExitGuardHook } from '@/features/profile/screens/CaloriesMacrosScreen';
import { routes } from '@/shared/navigation/routes';

/** ARCH-06: system back and swipe-back on a dirty form ask `Discard changes?` like the app bar back (UX-00). */
const useNavigationExitGuard: ExitGuardHook = (enabled, onAttempt) => {
  const navigation = useNavigation();
  usePreventRemove(enabled, ({ data }) => onAttempt(() => navigation.dispatch(data.action)));
};

/**
 * UX-16 Calories & Macros in the Profile stack. NAV-06: Save → Profile; back follows the same stack (NAV-01), also
 * when opened from the Diary's `Set goals` (UX-01), which pushes it with the Profile hub underneath.
 */
export default function CaloriesMacrosRoute() {
  const onSaved = useCallback(() => router.dismissTo(routes.profile()), []);
  const onCancel = useCallback(() => router.back(), []);
  return <CaloriesMacrosScreen onSaved={onSaved} onCancel={onCancel} useExitGuard={useNavigationExitGuard} />;
}
