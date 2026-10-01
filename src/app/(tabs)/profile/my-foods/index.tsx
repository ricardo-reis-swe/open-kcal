import { router } from 'expo-router';

import { MyFoodsScreen } from '@/features/food-search/screens/MyFoodsScreen';
import { routes } from '@/shared/navigation/routes';

/** NAV-06 / UX-25 My foods. A food opens its details, editable (DATA-26). */
export default function MyFoodsRoute() {
  return (
    <MyFoodsScreen
      onBack={() => router.back()}
      onOpenFood={(food) => router.push(routes.editCustomFood({ foodId: food.id }))}
    />
  );
}
