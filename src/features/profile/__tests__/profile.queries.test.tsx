import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { createQueryClient } from '@/bootstrap/query-client';
import { ServicesProvider, type AppServices } from '@/bootstrap/services';
import { useAppSettings, useDiaryDay, useMeals } from '@/features/diary/diary.queries';
import { createTestServices } from '@/shared/testing/services';

import {
  useCurrentGoal,
  useCurrentWeight,
  useMealWrites,
  useSaveGoals,
  useUpdateUnits,
  useWeightHistory,
  useWeightWrites,
} from '../profile.queries';

const clients: ReturnType<typeof createQueryClient>[] = [];
afterEach(() => {
  for (const client of clients.splice(0)) client.clear();
});

function wrapperFor(services: AppServices) {
  const client = createQueryClient();
  // Finished mutations keep a 5 min GC timer that `clear()` doesn't cancel, which kept Jest from exiting.
  const defaults = client.getDefaultOptions();
  client.setDefaultOptions({ ...defaults, mutations: { ...defaults.mutations, gcTime: 0 } });
  clients.push(client);
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <ServicesProvider services={services}>
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      </ServicesProvider>
    );
  }
  return Wrapper;
}

describe('M8 Profile query hooks (ARCH-08: commit → invalidate → UI)', () => {
  it('UX-18: a unit change refreshes the shared settings query every screen reads (DATA-04)', async () => {
    const { services } = await createTestServices();
    const { result } = await renderHook(() => ({ settings: useAppSettings(), update: useUpdateUnits() }), {
      wrapper: wrapperFor(services),
    });
    await waitFor(() => expect(result.current.settings.data?.energyUnit).toBe('kcal'));
    await act(() => result.current.update.mutateAsync({ energyUnit: 'kJ', weightUnit: 'lb' }));
    await waitFor(() => expect(result.current.settings.data).toMatchObject({ energyUnit: 'kJ', weightUnit: 'lb' }));
  });

  it('UX-01 / DATA-09: the first goal save confirms goals and refreshes the goal and the Diary day', async () => {
    const { services } = await createTestServices();
    const { result } = await renderHook(
      () => ({
        goal: useCurrentGoal(),
        settings: useAppSettings(),
        day: useDiaryDay('2026-09-25'),
        save: useSaveGoals(),
      }),
      { wrapper: wrapperFor(services) },
    );
    await waitFor(() => expect(result.current.day.data?.goal?.calorieTargetKcal).toBe(2000));
    expect(result.current.settings.data?.goalsConfirmedAt).toBeNull();
    await act(() =>
      result.current.save.mutateAsync({
        calorieTargetKcal: 1800,
        carbohydrateTargetG: 200,
        proteinTargetG: 120,
        fatTargetG: 60,
      }),
    );
    await waitFor(() => expect(result.current.day.data?.goal?.calorieTargetKcal).toBe(1800));
    expect(result.current.goal.data?.calorieTargetKcal).toBe(1800);
    expect(result.current.settings.data?.goalsConfirmedAt).not.toBeNull();
  });

  it('UX-17 / DATA-10: reorder and delete + reassign refresh the meal list and the Diary', async () => {
    const { services } = await createTestServices();
    const [breakfast, lunch, dinner, snacks] = await services.meals.list();
    await services.diary.addQuickCalories({ diaryDate: '2026-09-25', mealId: lunch!.id, energyKcal: 300, note: null });
    const { result } = await renderHook(
      () => ({ meals: useMeals(), day: useDiaryDay('2026-09-25'), writes: useMealWrites() }),
      { wrapper: wrapperFor(services) },
    );
    await waitFor(() => expect(result.current.day.data?.meals).toHaveLength(4));

    await act(() => result.current.writes.reorder.mutateAsync([snacks!.id, dinner!.id, lunch!.id, breakfast!.id]));
    await waitFor(() =>
      expect(result.current.meals.data?.map((m) => m.name)).toEqual(['Snacks', 'Dinner', 'Lunch', 'Breakfast']),
    );

    await act(() => result.current.writes.remove.mutateAsync({ id: lunch!.id, targetMealId: dinner!.id }));
    await waitFor(() =>
      expect(result.current.day.data?.meals.map((m) => m.meal.name)).toEqual(['Snacks', 'Dinner', 'Breakfast']),
    );
    const dinnerDay = result.current.day.data!.meals.find((m) => m.meal.id === dinner!.id)!;
    expect(dinnerDay.totals.energyKcal).toBe(300);
  });

  it('UX-14 / DATA-13: weight writes refresh current weight and history', async () => {
    const { services } = await createTestServices();
    const { result } = await renderHook(
      () => ({ current: useCurrentWeight(), history: useWeightHistory(), writes: useWeightWrites() }),
      { wrapper: wrapperFor(services) },
    );
    await waitFor(() => expect(result.current.current.isSuccess).toBe(true));
    expect(result.current.current.data).toBeNull();

    const older = await act(() => result.current.writes.add.mutateAsync({ localDate: '2026-09-20', weightKg: 83 }));
    const latest = await act(() => result.current.writes.add.mutateAsync({ localDate: '2026-09-25', weightKg: 82.4 }));
    await waitFor(() => expect(result.current.current.data?.id).toBe(latest.id));
    expect(result.current.history.data?.map((w) => w.id)).toEqual([latest.id, older.id]);

    await act(() => result.current.writes.update.mutateAsync({ id: older.id, localDate: '2026-09-20', weightKg: 84 }));
    await act(() => result.current.writes.remove.mutateAsync(latest.id));
    await waitFor(() => expect(result.current.current.data).toMatchObject({ id: older.id, weightKg: 84 }));
    expect(result.current.history.data).toHaveLength(1);
  });
});
