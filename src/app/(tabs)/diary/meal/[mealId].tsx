import { useLocalSearchParams } from 'expo-router';

import { MealDetailScreen } from '@/features/diary/screens/MealDetailScreen';
import { parseRouteParams } from '@/shared/navigation/routes';

// UX-03 Meal Detail. Params are validated before use (ARCH-03, NAV-09).
export default function MealDetailRoute() {
  const params = parseRouteParams('mealDetail', useLocalSearchParams());
  return <MealDetailScreen params={params} />;
}
