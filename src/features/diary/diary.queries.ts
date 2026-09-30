// Diary screen models (ARCH-07): SQLite reads through repositories, cached by TanStack Query.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useServices } from '@/bootstrap/services';
import type {
  AddFoodEntryInput,
  CopyEntryInput,
  CopyMealInput,
  DiaryEntry,
  EditFoodEntryInput,
  QuickCaloriesInput,
} from '@/data/db/repositories/diaryRepository';
import type { DashboardNutrients } from '@/domain/nutrition/dashboardNutrients';
import type { LocalDate } from '@/shared/dates';

export const diaryKeys = {
  all: ['diary'] as const,
  day: (date: LocalDate) => ['diary', 'day', date] as const,
  entry: (id: string) => ['diary', 'entry', id] as const,
};

export const settingsKeys = {
  all: ['settings'] as const,
  dashboardNutrients: ['settings', 'dashboardNutrients'] as const,
  dashboardNutrientsOpen: ['settings', 'dashboardNutrientsOpen'] as const,
  themePreference: ['settings', 'themePreference'] as const,
};
export const mealKeys = { all: ['meals'] as const };

export function useDiaryDay(date: LocalDate) {
  const { diary } = useServices();
  return useQuery({ queryKey: diaryKeys.day(date), queryFn: () => diary.loadDay(date) });
}

export function useAppSettings() {
  const { settings } = useServices();
  return useQuery({ queryKey: settingsKeys.all, queryFn: () => settings.get() });
}

/** DATA-21: the Diary nutrient panel's nutrients, in order (UX-02, UX-21). */
export function useDashboardNutrients() {
  const { settings } = useServices();
  return useQuery({ queryKey: settingsKeys.dashboardNutrients, queryFn: () => settings.getDashboardNutrients() });
}

/** UX-21: every switch change or drop saves immediately (as Units). */
export function useSetDashboardNutrients() {
  const { settings } = useServices();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (items: DashboardNutrients) => settings.setDashboardNutrients(items),
    onSuccess: (saved) => client.setQueryData(settingsKeys.dashboardNutrients, saved),
  });
}

/** DATA-21: whether the Diary nutrient panel is open. */
export function useDashboardNutrientsOpen() {
  const { settings } = useServices();
  return useQuery({
    queryKey: settingsKeys.dashboardNutrientsOpen,
    queryFn: () => settings.getDashboardNutrientsOpen(),
  });
}

/** UX-02: the chevron flips the panel at once (optimistic) and persists the new state. */
export function useSetDashboardNutrientsOpen() {
  const { settings } = useServices();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (open: boolean) => settings.setDashboardNutrientsOpen(open),
    onMutate: (open) => client.setQueryData(settingsKeys.dashboardNutrientsOpen, open),
    onError: (_error, open) => client.setQueryData(settingsKeys.dashboardNutrientsOpen, !open),
  });
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
  const addFoodEntry = useMutation({
    mutationFn: (input: AddFoodEntryInput) => diary.addFoodEntry(input),
    onSuccess: refresh,
  });
  const editFoodEntry = useMutation({
    mutationFn: ({ id, ...input }: EditFoodEntryInput & { id: string }) => diary.editFoodEntry(id, input),
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
  const restoreEntry = useMutation({
    mutationFn: (entry: DiaryEntry) => diary.restoreEntry(entry),
    onSuccess: refresh,
  });
  /** DATA-16 / NAV-07 Copy meal: resolves with `copiedCount` for the UX-12 success toast. */
  const copyMeal = useMutation({
    mutationFn: (input: CopyMealInput) => diary.copyMeal(input),
    onSuccess: refresh,
  });
  const copyEntry = useMutation({
    mutationFn: (input: CopyEntryInput) => diary.copyEntry(input),
    onSuccess: refresh,
  });
  return {
    addFoodEntry,
    editFoodEntry,
    addQuickCalories,
    editQuickCalories,
    deleteEntry,
    restoreEntry,
    copyMeal,
    copyEntry,
  };
}
