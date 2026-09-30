// TanStack Query client (ARCH-07). SQLite screen models are invalidated after commits, so they never go stale on
// their own and never wait for the network; remote provider queries opt into their own policies (M5/M6).
// The cache is never persisted.
import NetInfo from '@react-native-community/netinfo';
import { MutationCache, onlineManager, QueryClient } from '@tanstack/react-query';

import { refreshWidget } from '@/features/widget/refreshWidget';

let onlineManagerConfigured = false;

/** ARCH-12: remote provider queries pause while the device has no usable internet connection. */
export function configureOnlineManager(): void {
  if (onlineManagerConfigured) return;
  onlineManagerConfigured = true;
  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => {
      setOnline(Boolean(state.isConnected && state.isInternetReachable !== false));
    }),
  );
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    // DATA-22: every committed write redraws the Android widget; not wired per call site.
    mutationCache: new MutationCache({ onSuccess: () => refreshWidget() }),
    defaultOptions: {
      queries: { networkMode: 'always', staleTime: Infinity, retry: false },
      mutations: { networkMode: 'always', retry: false },
    },
  });
}
