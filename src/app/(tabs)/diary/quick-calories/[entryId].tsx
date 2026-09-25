import { useLocalSearchParams } from 'expo-router';

import { QuickCaloriesScreen } from '@/features/diary/screens/QuickCaloriesScreen';
import { parseRouteParams } from '@/shared/navigation/routes';

// UX-07 Edit Quick Calories. Params are validated before use (ARCH-03, NAV-09).
export default function EditQuickCaloriesRoute() {
  const params = parseRouteParams('editQuickCalories', useLocalSearchParams());
  return <QuickCaloriesScreen mode={params ? { kind: 'edit', ...params } : null} />;
}
