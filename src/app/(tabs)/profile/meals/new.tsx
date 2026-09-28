import { router } from 'expo-router';

import { MealEditScreen } from '@/features/profile/screens/MealEditScreen';
import { routes } from '@/shared/navigation/routes';

/** NAV-06 Add Meal: Save → Meals. */
export default function AddMealRoute() {
  return (
    <MealEditScreen
      params={{ mode: 'create' }}
      onDone={() => router.dismissTo(routes.meals())}
      onBack={() => router.back()}
      onNotFound={() => router.dismissTo(routes.profile())}
    />
  );
}
