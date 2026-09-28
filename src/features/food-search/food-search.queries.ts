// Local Food Search screen models (ARCH-07, UX-04). Remote sections arrive in M5/M6.
import { onlineManager, useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';

import { useServices, type AppServices } from '@/bootstrap/services';
import type { RecentFood } from '@/data/db/repositories/diaryRepository';
import type { FoodSearchSections } from '@/domain/food/searchSections';
import { settingsKeys } from '@/features/diary/diary.queries';
import type { CustomFoodInput, Food } from '@/data/db/repositories/foodsRepository';
import { PARSER_VERSION } from '@/data/api/open-food-facts/mapper';
import { PARSER_VERSION as USDA_PARSER_VERSION } from '@/data/api/usda/mapper';
import { nowUtcIso } from '@/shared/dates';

export type RecentFoodResult = RecentFood & { food: Food };

export const foodSearchKeys = {
  all: ['foodSearch'] as const,
  recents: ['foodSearch', 'recents'] as const,
  custom: (query: string) => ['foodSearch', 'custom', query.trim().toLocaleLowerCase()] as const,
  saved: (query: string) => ['foodSearch', 'saved', query.trim().toLocaleLowerCase()] as const,
  off: (query: string, page: number) => ['foodSearch', 'openFoodFacts', query.trim(), page] as const,
  usda: (query: string, page: number) => ['foodSearch', 'usda', query.trim(), page] as const,
  food: (id: string) => ['foodSearch', 'food', id] as const,
};

/** DATA-19 / UX-18 `Search results`: saved order + visibility of the 4 Food Search sections. */
export const foodSearchSectionsKey = [...settingsKeys.all, 'foodSearchSections'] as const;

export function useFoodSearchSections() {
  const { settings } = useServices();
  return useQuery({ queryKey: foodSearchSectionsKey, queryFn: () => settings.getFoodSearchSections() });
}

/** UX-18: every switch change or drop saves immediately (as Units); Food Search reads the stored value. */
export function useSetFoodSearchSections() {
  const { settings } = useServices();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (sections: FoodSearchSections) => settings.setFoodSearchSections(sections),
    onSuccess: (saved) => {
      client.setQueryData(foodSearchSectionsKey, saved);
      return client.invalidateQueries({ queryKey: foodSearchSectionsKey });
    },
  });
}

/** UX-04 / PROV-04: USDA starts after 400 ms with two characters; credentials never enter this key. */
export function useUsdaSearch(query: string, pages = 1, visible = true) {
  const { usda } = useServices();
  const normalized = query.trim();
  const results = useQueries({
    queries: Array.from({ length: pages }, (_, index) => {
      const page = index + 1;
      return {
        queryKey: foodSearchKeys.usda(normalized, page),
        queryFn: ({ signal }: { signal: AbortSignal }) => usda.search(normalized, page, signal),
        enabled: visible && normalized.length >= 2, // UX-18: a hidden section sends no requests
        networkMode: 'online' as const,
        staleTime: 10 * 60_000,
      };
    }),
  });
  return {
    data: results.flatMap((result) => result.data?.candidates ?? []),
    isLoading: results.some((result) => result.isLoading),
    isError: results.some((result) => result.isError),
    error: results.find((result) => result.error)?.error,
    isSuccess: results.length > 0 && results.every((result) => result.isSuccess),
    hasMore: results.at(-1)?.data ? results.at(-1)!.data!.page < results.at(-1)!.data!.pageCount && pages < 5 : false,
    refetch: () => Promise.all(results.map((result) => result.refetch())),
  };
}

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
export function useCustomFoodSearch(query: string, pages = 1, visible = true) {
  const { foods } = useServices();
  const normalized = query.trim();
  return useQuery({
    queryKey: [...foodSearchKeys.custom(normalized), pages],
    queryFn: async () => {
      const results = await Promise.all(
        Array.from({ length: pages }, (_, page) => foods.searchCustom(normalized, 20, page * 20)),
      );
      return results.flat();
    },
    enabled: visible && normalized.length > 0,
  });
}

/** DATA-15 / PROV-08: cached external foods are local results and work while offline. */
export function useSavedFoodSearch(query: string, pages = 1, visible = true) {
  const { foods } = useServices();
  const normalized = query.trim();
  return useQuery({
    queryKey: [...foodSearchKeys.saved(normalized), pages],
    queryFn: async () => {
      const results = await Promise.all(
        Array.from({ length: pages }, (_, page) => foods.searchExternal(normalized, 20, page * 20)),
      );
      return results.flat();
    },
    enabled: visible && normalized.length > 0,
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
export function useOpenFoodFactsSearch(query: string, pages = 1, language = 'en', visible = true) {
  const { openFoodFacts } = useServices();
  const normalized = query.trim();
  const results = useQueries({
    queries: Array.from({ length: pages }, (_, index) => {
      const page = index + 1;
      return {
        queryKey: foodSearchKeys.off(normalized, page),
        queryFn: ({ signal }: { signal: AbortSignal }) => openFoodFacts.search(normalized, page, signal, language),
        enabled: visible && normalized.length >= 3, // UX-18: a hidden section sends no requests (PROV-04 budget)
        networkMode: 'online' as const,
        staleTime: 10 * 60_000,
      };
    }),
  });
  return {
    data: results.flatMap((result) => result.data?.candidates ?? []),
    isLoading: results.some((result) => result.isLoading),
    isError: results.some((result) => result.isError),
    error: results.find((result) => result.error)?.error,
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

/** A remote search hit opens Food Detail immediately; that screen owns the provider detail read and cache upsert. */
export function useExternalFood(source: 'usda' | 'open_food_facts', externalId: string, enabled = true) {
  const services = useServices();
  return useQuery({
    queryKey: [...foodSearchKeys.food(`external:${source}`), externalId],
    queryFn: async ({ signal }) => {
      const candidate =
        source === 'usda'
          ? await services.usda.getFood(externalId, signal)
          : await services.openFoodFacts.getFood(externalId, signal);
      if (!candidate) throw new Error('External food detail unavailable');
      const fetchedAt = nowUtcIso(services.clock);
      const expiresAt = new Date(
        services.clock.now().getTime() + (source === 'usda' ? 90 : 30) * 24 * 60 * 60_000,
      ).toISOString() as typeof fetchedAt;
      return services.foods.upsertExternal(source, candidate.externalId, candidate.input, {
        fetchedAt,
        expiresAt,
        rawPayloadJson: null,
        schemaVersion: source === 'usda' ? USDA_PARSER_VERSION : PARSER_VERSION,
      });
    },
    enabled: enabled && externalId.length > 0,
  });
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
  const restoreCustom = useMutation({ mutationFn: (id: string) => foods.restoreCustom(id), onSuccess: refresh });
  return { createCustom, deleteCustom, restoreCustom };
}
