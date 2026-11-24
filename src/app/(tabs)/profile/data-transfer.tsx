import { router } from 'expo-router';

import { DataTransferScreen } from '@/features/profile/screens/DataTransferScreen';

/** NAV-06 / UX-29: back → Profile; a successful import remounts the Router (NAV-11). */
export default function DataTransferRoute() {
  return <DataTransferScreen onBack={() => router.back()} />;
}
