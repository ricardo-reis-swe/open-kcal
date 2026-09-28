import { router, useLocalSearchParams } from 'expo-router';

import { MealEditScreen } from '@/features/profile/screens/MealEditScreen';
import { parseRouteParams, routes } from '@/shared/navigation/routes';

/** NAV-06 Edit Meal: Save or delete → Meals. Params are validated before use (ARCH-03, NAV-09). */
export default function EditMealRoute() {
  const parsed = parseRouteParams('mealEdit', useLocalSearchParams());
  return (
    <MealEditScreen
      params={parsed ? { mode: 'edit', mealId: parsed.mealId } : null}
      onDone={() => router.dismissTo(routes.meals())}
      onBack={() => router.back()}
      onNotFound={() => router.dismissTo(routes.profile())}
    />
  );
}
