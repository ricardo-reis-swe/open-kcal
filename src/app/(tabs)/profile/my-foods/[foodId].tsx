import { useLocalSearchParams } from 'expo-router';

import { FoodDetailScreen } from '@/features/food-search/screens/FoodDetailScreen';
import { parseRouteParams } from '@/shared/navigation/routes';

/** UX-25: Food Detail / Add Entry from My foods; Add and back return to My foods (NAV-06). */
export default function MyFoodDetailRoute() {
  const params = parseRouteParams('foodDetail', useLocalSearchParams());
  return <FoodDetailScreen mode={params ? { kind: 'add', ...params } : null} stack="profile" />;
}
