import { router } from 'expo-router';

import { useDiaryDate } from '@/features/diary/hooks/DiaryDateContext';
import { MyFoodsScreen } from '@/features/food-search/screens/MyFoodsScreen';
import { routes } from '@/shared/navigation/routes';

/** NAV-06 / UX-25 My foods. A food opens Food Detail on this stack for the Diary's selected date (NAV-05). */
export default function MyFoodsRoute() {
  const { date } = useDiaryDate();
  return (
    <MyFoodsScreen
      onBack={() => router.back()}
      onOpenFood={(food, mealId) => router.push(routes.myFoodDetail({ foodId: food.id, mealId, date }))}
    />
  );
}
