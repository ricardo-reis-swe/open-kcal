import { router } from 'expo-router';

import { WeightGoalScreen } from '@/features/profile/screens/WeightGoalScreen';
import { routes } from '@/shared/navigation/routes';

/** NAV-06 / UX-18 Weight Goal: Save (or Clear goal) → Profile; a dirty back silently discards (UX-00). */
export default function WeightGoalRoute() {
  return <WeightGoalScreen onSaved={() => router.dismissTo(routes.profile())} onBack={() => router.back()} />;
}
