// Profile screen models (ARCH-07/08): goals, units, goal weight, meals and weight history through repositories.
// Writes commit first, then invalidate every query that shows the changed data (no optimistic display).
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { useServices } from '@/bootstrap/services';
import type { NutritionTargets } from '@/domain/nutrition/goals';
import type { UnitPreferences } from '@/domain/units/units';
import type { WeightInput } from '@/data/db/repositories/weightRepository';
import { diaryKeys, mealKeys, settingsKeys } from '@/features/diary/diary.queries';
import { foodSearchKeys } from '@/features/food-search/food-search.queries';
import { todayLocal } from '@/shared/dates';

export const goalKeys = {
  all: ['goals'] as const,
  forDate: (date: string) => ['goals', 'for', date] as const,
};

export const weightKeys = {
  all: ['weight'] as const,
  current: ['weight', 'current'] as const,
  history: ['weight', 'history'] as const,
  entry: (id: string) => ['weight', 'entry', id] as const,
};

export const mealDetailKeys = {
  meal: (id: string) => ['meals', 'one', id] as const,
  entryCount: (id: string) => ['meals', 'entryCount', id] as const,
};

/** The goal in effect today (UX-15 Calories & macros row, UX-16 initial values). */
export function useCurrentGoal() {
  const { goals, clock } = useServices();
  const today = todayLocal(clock);
  return useQuery({ queryKey: goalKeys.forDate(today), queryFn: () => goals.goalFor(today) });
}

/** UX-16 save (DATA-09; UX-01 first save confirms goals, so the Diary's default-goals row disappears). */
export function useSaveGoals() {
  const { goals } = useServices();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (targets: NutritionTargets) => goals.save(targets),
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: goalKeys.all }),
        client.invalidateQueries({ queryKey: settingsKeys.all }),
        client.invalidateQueries({ queryKey: diaryKeys.all }),
      ]),
  });
}

/**
 * UX-18 Units: each change saves immediately. Every screen reads units from the one settings query, so refreshing it
 * shows the change everywhere; stored records are never rewritten (DATA-04).
 */
export function useUpdateUnits() {
  const { settings } = useServices();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (units: Partial<UnitPreferences>) => settings.updateUnits(units),
    onSuccess: () => client.invalidateQueries({ queryKey: settingsKeys.all }),
  });
}

/** UX-18 Weight Goal: canonical kg, `null` = `Clear goal`. */
export function useSetGoalWeight() {
  const { settings } = useServices();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (kg: number | null) => settings.setGoalWeightKg(kg),
    onSuccess: () => client.invalidateQueries({ queryKey: settingsKeys.all }),
  });
}

/** One meal by ID; a deleted ID rejects with `NotFoundError` (UX-00 not found). */
export function useMeal(id: string, enabled = true) {
  const { meals } = useServices();
  return useQuery({ queryKey: mealDetailKeys.meal(id), queryFn: () => meals.get(id), enabled });
}

/** Entries in a meal (all dates): decides the UX-19 dialog vs the move-entries sheet. */
export function useMealEntryCount(id: string, enabled = true) {
  const { meals } = useServices();
  return useQuery({ queryKey: mealDetailKeys.entryCount(id), queryFn: () => meals.countEntries(id), enabled });
}

/** Meal changes show in the Diary, pickers and recents (`last_meal_id`), so all of them refresh. */
function refreshMeals(client: QueryClient) {
  return Promise.all([
    client.invalidateQueries({ queryKey: mealKeys.all }),
    client.invalidateQueries({ queryKey: diaryKeys.all }),
    client.invalidateQueries({ queryKey: foodSearchKeys.recents }),
  ]);
}

/** UX-17 / DATA-10 meal writes. `remove` is the one-transaction delete + reassign (full rollback on failure). */
export function useMealWrites() {
  const { meals } = useServices();
  const client = useQueryClient();
  const create = useMutation({
    mutationFn: (name: string) => meals.create(name),
    onSuccess: () => refreshMeals(client),
  });
  const rename = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => meals.rename(id, name),
    onSuccess: () => refreshMeals(client),
  });
  const reorder = useMutation({
    mutationFn: (orderedIds: readonly string[]) => meals.reorder(orderedIds),
    onSuccess: () => refreshMeals(client),
  });
  const remove = useMutation({
    mutationFn: ({ id, targetMealId }: { id: string; targetMealId: string | null }) => meals.delete(id, targetMealId),
    // The deleted meal's own queries must not refetch (they would now fail as not found).
    onSuccess: (_void, { id }) => {
      client.removeQueries({ queryKey: mealDetailKeys.meal(id) });
      client.removeQueries({ queryKey: mealDetailKeys.entryCount(id) });
      return refreshMeals(client);
    },
  });
  return { create, rename, reorder, remove };
}

/** Current weight (DATA-13: latest measured_at, tie-break created_at); `null` = none logged yet (UX-15). */
export function useCurrentWeight() {
  const { weight } = useServices();
  return useQuery({ queryKey: weightKeys.current, queryFn: () => weight.current() });
}

/** UX-18 Weight History, newest first. Pair with `weightHistoryRows` for time + change display. */
export function useWeightHistory() {
  const { weight } = useServices();
  return useQuery({ queryKey: weightKeys.history, queryFn: () => weight.history() });
}

/** One weight entry (UX-14 edit); a deleted ID rejects with `NotFoundError`. */
export function useWeightEntry(id: string, enabled = true) {
  const { weight } = useServices();
  return useQuery({ queryKey: weightKeys.entry(id), queryFn: () => weight.get(id), enabled });
}

/** UX-14 writes; input is canonical kg (convert from `weight_unit` first). Current weight recomputes on refresh. */
export function useWeightWrites() {
  const { weight } = useServices();
  const client = useQueryClient();
  const refresh = () => client.invalidateQueries({ queryKey: weightKeys.all });
  const add = useMutation({ mutationFn: (input: WeightInput) => weight.add(input), onSuccess: refresh });
  const update = useMutation({
    mutationFn: ({ id, ...input }: WeightInput & { id: string }) => weight.update(id, input),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (id: string) => weight.delete(id),
    onSuccess: (_void, id) => {
      client.removeQueries({ queryKey: weightKeys.entry(id) });
      return refresh();
    },
  });
  return { add, update, remove };
}
