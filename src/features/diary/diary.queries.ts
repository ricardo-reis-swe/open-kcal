// Diary screen models (ARCH-07): SQLite reads through repositories, cached by TanStack Query.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useServices } from '@/bootstrap/services';
import type { QuickCaloriesInput } from '@/data/db/repositories/diaryRepository';
import type { LocalDate } from '@/shared/dates';

export const diaryKeys = {
  all: ['diary'] as const,
  day: (date: LocalDate) => ['diary', 'day', date] as const,
  entry: (id: string) => ['diary', 'entry', id] as const,
};

export const settingsKeys = { all: ['settings'] as const };
export const mealKeys = { all: ['meals'] as const };

export function useDiaryDay(date: LocalDate) {
  const { diary } = useServices();
  return useQuery({ queryKey: diaryKeys.day(date), queryFn: () => diary.loadDay(date) });
}

export function useAppSettings() {
  const { settings } = useServices();
  return useQuery({ queryKey: settingsKeys.all, queryFn: () => settings.get() });
}

/** Meals in the user's saved order (NAV-07 Meal Picker; never fixed names). */
export function useMeals() {
  const { meals } = useServices();
  return useQuery({ queryKey: mealKeys.all, queryFn: () => meals.list() });
}

/** One entry by ID; a deleted or unknown ID rejects with `NotFoundError` (UX-00 not found). */
export function useDiaryEntry(id: string, enabled = true) {
  const { diary } = useServices();
  return useQuery({ queryKey: diaryKeys.entry(id), queryFn: () => diary.getEntry(id), enabled });
}

/**
 * Diary writes (ARCH-08): the repository commits, then every diary query is invalidated and refetched before the
 * mutation resolves, so the screen we return to shows fresh totals (NAV-09). No optimistic display.
 */
export function useDiaryWrites() {
  const { diary } = useServices();
  const client = useQueryClient();
  const refresh = () => client.invalidateQueries({ queryKey: diaryKeys.all });
  const addQuickCalories = useMutation({
    mutationFn: (input: QuickCaloriesInput) => diary.addQuickCalories(input),
    onSuccess: refresh,
  });
  const editQuickCalories = useMutation({
    mutationFn: ({ id, ...input }: Omit<QuickCaloriesInput, 'diaryDate'> & { id: string }) =>
      diary.editQuickCalories(id, input),
    onSuccess: refresh,
  });
  const deleteEntry = useMutation({
    mutationFn: (id: string) => diary.deleteEntry(id),
    // The deleted entry's own query must not refetch (it would now fail as not found).
    onSuccess: (_void, id) => {
      client.removeQueries({ queryKey: diaryKeys.entry(id) });
      return refresh();
    },
  });
  return { addQuickCalories, editQuickCalories, deleteEntry };
}
