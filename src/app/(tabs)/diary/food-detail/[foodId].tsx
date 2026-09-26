import { useLocalSearchParams } from 'expo-router';

import { FoodDetailScreen } from '@/features/food-search/screens/FoodDetailScreen';
import { parseRouteParams } from '@/shared/navigation/routes';

export default function FoodDetailRoute() {
  const params = parseRouteParams('foodDetail', useLocalSearchParams());
  return <FoodDetailScreen mode={params} />;
}
