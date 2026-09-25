// TanStack Query client (ARCH-07). SQLite screen models are invalidated after commits, so they never go stale on
// their own and never wait for the network; remote provider queries opt into their own policies (M5/M6).
// The cache is never persisted.
import { QueryClient } from '@tanstack/react-query';

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { networkMode: 'always', staleTime: Infinity, retry: false },
      mutations: { networkMode: 'always', retry: false },
    },
  });
}
