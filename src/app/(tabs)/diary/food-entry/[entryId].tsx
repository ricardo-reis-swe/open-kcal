import { useLocalSearchParams } from 'expo-router';

import { FoodDetailScreen } from '@/features/food-search/screens/FoodDetailScreen';
import { parseRouteParams } from '@/shared/navigation/routes';

export default function EditFoodEntryRoute() {
  const params = parseRouteParams('editFoodEntry', useLocalSearchParams());
  return <FoodDetailScreen mode={params ? { kind: 'edit', ...params } : null} />;
}
