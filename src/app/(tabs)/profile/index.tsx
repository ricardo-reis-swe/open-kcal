import { router } from 'expo-router';
import { useOpenWeightEntry } from '@/features/profile/hooks/WeightEntryContext';
import { ProfileScreen } from '@/features/profile/screens/ProfileScreen';
import { routes } from '@/shared/navigation/routes';

export default function ProfileRoute() {
  const openWeightEntry = useOpenWeightEntry();
  return (
    <ProfileScreen
      onUpdateWeight={() => openWeightEntry({ mode: 'create' })}
      onWeightHistory={() => router.push(routes.weightHistory())}
      onCaloriesMacros={() => router.push(routes.caloriesMacros())}
      onMeals={() => router.push(routes.meals())}
      onUnits={() => router.push(routes.units())}
      onDashboardNutrients={() => router.push(routes.dashboardNutrients())}
      onWeightGoal={() => router.push(routes.weightGoal())}
      onFoodDatabases={() => router.push(routes.foodDatabases())}
    />
  );
}
