import { router } from 'expo-router';

import { MyFoodsScreen } from '@/features/food-search/screens/MyFoodsScreen';
import { routes } from '@/shared/navigation/routes';

/** NAV-06 / UX-27 My recipes. A recipe opens the editor (UX-26 edit mode, DATA-28). */
export default function MyRecipesRoute() {
  return (
    <MyFoodsScreen
      variant="recipes"
      onBack={() => router.back()}
      onOpenFood={(food) => router.push(routes.editRecipe({ foodId: food.id }))}
    />
  );
}
