import { useLocalSearchParams } from 'expo-router';

import { QuickCaloriesScreen } from '@/features/diary/screens/QuickCaloriesScreen';
import { parseRouteParams } from '@/shared/navigation/routes';

// UX-07 Quick Calories (add). Params are validated before use (ARCH-03, NAV-09).
export default function QuickCaloriesRoute() {
  const params = parseRouteParams('quickCalories', useLocalSearchParams());
  return <QuickCaloriesScreen mode={params ? { kind: 'add', ...params } : null} />;
}
