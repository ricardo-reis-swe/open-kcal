import { router } from 'expo-router';

import { ImportRecipeScreen } from '@/features/recipes/screens/ImportRecipeScreen';

/** NAV-06 / UX-28: return to the My recipes list after a successful import. */
export default function ImportRecipeRoute() {
  return <ImportRecipeScreen onBack={() => router.back()} onImported={() => router.back()} />;
}
