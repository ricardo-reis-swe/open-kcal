import { router } from 'expo-router';

import { useOpenWeightEntry } from '@/features/profile/hooks/WeightEntryContext';
import { WeightHistoryScreen } from '@/features/profile/screens/WeightHistoryScreen';

/** NAV-06 / UX-18 Weight History: `+` and rows open the Weight Entry Sheet (create / edit) over this screen. */
export default function WeightHistoryRoute() {
  const openWeightEntry = useOpenWeightEntry();
  return (
    <WeightHistoryScreen
      onBack={() => router.back()}
      onAdd={() => openWeightEntry({ mode: 'create' })}
      onEdit={(weightEntryId) => openWeightEntry({ mode: 'edit', weightEntryId })}
    />
  );
}
