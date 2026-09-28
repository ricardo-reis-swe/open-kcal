import { router } from 'expo-router';
import { ProfileScreen } from '@/features/profile/screens/ProfileScreen';
import { routes } from '@/shared/navigation/routes';

export default function ProfileRoute() {
  return (
    <ProfileScreen
      onCaloriesMacros={() => router.push(routes.caloriesMacros())}
      onMeals={() => router.push(routes.meals())}
      onUnits={() => router.push(routes.units())}
      onWeightGoal={() => router.push(routes.weightGoal())}
      onFoodDatabases={() => router.push(routes.foodDatabases())}
    />
  );
}
