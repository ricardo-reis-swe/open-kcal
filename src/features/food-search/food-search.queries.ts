// Local Food Search screen models (ARCH-07, UX-04). Remote sections arrive in M5/M6.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useServices, type AppServices } from '@/bootstrap/services';
import type { RecentFood } from '@/data/db/repositories/diaryRepository';
import type { CustomFoodInput, Food } from '@/data/db/repositories/foodsRepository';

export type RecentFoodResult = RecentFood & { food: Food };

export const foodSearchKeys = {
  all: ['foodSearch'] as const,
  recents: ['foodSearch', 'recents'] as const,
  custom: (query: string) => ['foodSearch', 'custom', query.trim().toLocaleLowerCase()] as const,
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
