import { router } from 'expo-router';

import { MealsScreen } from '@/features/profile/screens/MealsScreen';
import { routes } from '@/shared/navigation/routes';

/** NAV-06 / UX-17 Meals in the Profile stack. */
export default function MealsRoute() {
  return (
    <MealsScreen
      onBack={() => router.back()}
      onAddMeal={() => router.push(routes.mealEdit({ mode: 'create' }))}
      onEditMeal={(mealId) => router.push(routes.mealEdit({ mode: 'edit', mealId }))}
    />
  );
}
