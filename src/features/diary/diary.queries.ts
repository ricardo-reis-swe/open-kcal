// Diary screen models (ARCH-07): SQLite reads through repositories, cached by TanStack Query.
import { useQuery } from '@tanstack/react-query';

import { useServices } from '@/bootstrap/services';
import type { LocalDate } from '@/shared/dates';

export const diaryKeys = {
  all: ['diary'] as const,
  day: (date: LocalDate) => ['diary', 'day', date] as const,
};

export const settingsKeys = { all: ['settings'] as const };

export function useDiaryDay(date: LocalDate) {
  const { diary } = useServices();
  return useQuery({ queryKey: diaryKeys.day(date), queryFn: () => diary.loadDay(date) });
}

export function useAppSettings() {
  const { settings } = useServices();
  return useQuery({ queryKey: settingsKeys.all, queryFn: () => settings.get() });
}
