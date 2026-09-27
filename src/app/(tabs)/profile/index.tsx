import { router } from 'expo-router';
import { ProfileScreen } from '@/features/profile/screens/ProfileScreen';
import { routes } from '@/shared/navigation/routes';

export default function ProfileRoute() {
  return <ProfileScreen onFoodDatabases={() => router.push(routes.foodDatabases())} />;
}
