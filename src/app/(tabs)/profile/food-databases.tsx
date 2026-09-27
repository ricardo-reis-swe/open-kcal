import { router } from 'expo-router';

import { FoodDatabasesScreen } from '@/features/profile/screens/FoodDatabasesScreen';

export default function FoodDatabasesRoute() {
  return <FoodDatabasesScreen onBack={() => router.back()} />;
}
