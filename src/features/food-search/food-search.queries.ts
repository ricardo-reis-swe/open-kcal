// Local Food Search screen models (ARCH-07, UX-04). Remote sections arrive in M5/M6.
import { onlineManager, useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';

import { useServices, type AppServices } from '@/bootstrap/services';
import type { RecentFood } from '@/data/db/repositories/diaryRepository';
import type { CustomFoodInput, Food } from '@/data/db/repositories/foodsRepository';
import { PARSER_VERSION } from '@/data/api/open-food-facts/mapper';
import { nowUtcIso } from '@/shared/dates';

export type RecentFoodResult = RecentFood & { food: Food };

export const foodSearchKeys = {
  all: ['foodSearch'] as const,
  recents: ['foodSearch', 'recents'] as const,
  custom: (query: string) => ['foodSearch', 'custom', query.trim().toLocaleLowerCase()] as const,
  saved: (query: string) => ['foodSearch', 'saved', query.trim().toLocaleLowerCase()] as const,
  off: (query: string, page: number) => ['foodSearch', 'openFoodFacts', query.trim(), page] as const,
  food: (id: string) => ['foodSearch', 'food', id] as const,
};

/** UX-04 / DATA-14: hydrate the newest ≤20 recent records with their selectable food and servings. */
export async function loadRecentFoods(
  services: Pick<AppServices, 'recents' | 'foods'>,
  limit = 20,
): Promise<RecentFoodResult[]> {
  const recents = await services.recents.list(limit);
  return Promise.all(recents.map(async (recent) => ({ ...recent, food: await services.foods.get(recent.foodId) })));
}

export function useRecentFoods() {
  const services = useServices();
  return useQuery({ queryKey: foodSearchKeys.recents, queryFn: () => loadRecentFoods(services) });
}

/** M4 local search runs on every debounced query; provider requests are added separately in M5/M6. */
export function useCustomFoodSearch(query: string) {
  const { foods } = useServices();
  const normalized = query.trim();
  return useQuery({
    queryKey: foodSearchKeys.custom(normalized),
    queryFn: () => foods.searchCustom(normalized),
    enabled: normalized.length > 0,
  });
}

/** DATA-15 / PROV-08: cached external foods are local results and work while offline. */
export function useSavedFoodSearch(query: string) {
  const { foods } = useServices();
  const normalized = query.trim();
  return useQuery({
    queryKey: foodSearchKeys.saved(normalized),
    queryFn: () => foods.searchExternal(normalized),
    enabled: normalized.length > 0,
  });
}

/** PROV-09: expired saved OFF foods open immediately; a successful refresh is only visible on a later open. */
export async function refreshSavedOpenFoodFacts(services: AppServices, food: Food): Promise<void> {
  if (food.source !== 'open_food_facts' || !food.externalId) return;
  const cache = await services.foods.cacheMetadata(food.id);
  if (!cache || (!cache.isExpired && cache.schemaVersion >= PARSER_VERSION)) return;
  try {
    const candidate = await services.openFoodFacts.getFood(food.externalId, new AbortController().signal);
    if (!candidate) return;
    const fetchedAt = nowUtcIso(services.clock);
    const expiresAt = new Date(
      services.clock.now().getTime() + 30 * 24 * 60 * 60_000,
    ).toISOString() as typeof fetchedAt;
    await services.foods.upsertExternal('open_food_facts', candidate.externalId, candidate.input, {
      fetchedAt,
      expiresAt,
      rawPayloadJson: null,
      schemaVersion: PARSER_VERSION,
    });
  } catch {
    // PROV-09: refresh failures are silent; the cached food remains fully usable.
  }
}

/** UX-04 / PROV-04: OFF starts after 800 ms and at least three typed characters. */
export function useOpenFoodFactsSearch(query: string, pages = 1, language = 'en') {
  const { openFoodFacts } = useServices();
  const normalized = query.trim();
  const results = useQueries({
    queries: Array.from({ length: pages }, (_, index) => {
      const page = index + 1;
      return {
        queryKey: foodSearchKeys.off(normalized, page),
        queryFn: ({ signal }: { signal: AbortSignal }) => openFoodFacts.search(normalized, page, signal, language),
        enabled: normalized.length >= 3,
        networkMode: 'online' as const,
        staleTime: 10 * 60_000,
      };
    }),
  });
  return {
    data: results.flatMap((result) => result.data?.candidates ?? []),
    isLoading: results.some((result) => result.isLoading),
    isError: results.some((result) => result.isError),
    isSuccess: results.length > 0 && results.every((result) => result.isSuccess),
    hasMore: results.at(-1)?.data ? results.at(-1)!.data!.page < results.at(-1)!.data!.pageCount && pages < 5 : false,
    refetch: () => Promise.all(results.map((result) => result.refetch())),
  };
}

/** ARCH-12: local sections remain usable while remote-provider sections are paused offline. */
export function useOnlineStatus() {
  return useSyncExternalStore(
    onlineManager.subscribe.bind(onlineManager),
    onlineManager.isOnline.bind(onlineManager),
    onlineManager.isOnline.bind(onlineManager),
  );
}

export function useFood(foodId: string, enabled = true) {
  const { foods } = useServices();
  return useQuery({ queryKey: foodSearchKeys.food(foodId), queryFn: () => foods.get(foodId), enabled });
}

/** Local-food writes refresh every local Food Search section after the transaction commits (ARCH-08). */
export function useLocalFoodWrites() {
  const { foods } = useServices();
  const client = useQueryClient();
  const refresh = () => client.invalidateQueries({ queryKey: foodSearchKeys.all });
  const createCustom = useMutation({
    mutationFn: (input: CustomFoodInput) => foods.createCustom(input),
    onSuccess: refresh,
  });
  const deleteCustom = useMutation({ mutationFn: (id: string) => foods.deleteCustom(id), onSuccess: refresh });
  return { createCustom, deleteCustom };
}
