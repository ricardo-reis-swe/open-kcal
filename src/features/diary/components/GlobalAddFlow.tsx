import { router } from 'expo-router';
import { useRef, useState } from 'react';

import { AddActionSheet } from '@/shared/navigation/AddActionSheet';
import { MealPicker } from '@/shared/navigation/MealPicker';
import { routes } from '@/shared/navigation/routes';

import { useMeals } from '../diary.queries';
import { useDiaryDate } from '../hooks/DiaryDateContext';

type Props = { open: boolean; onClose: () => void };

/**
 * `+` flows (NAV-03), from either tab: Add Action Sheet → Meal Picker → the flow's screen on the selected diary date.
 * Each sheet closes fully before the next sheet or route opens. With exactly one meal the picker is skipped (UX-10).
 */
export function GlobalAddFlow({ open, onClose }: Props) {
  const { date } = useDiaryDate();
  const meals = useMeals();
  const [picking, setPicking] = useState(false);
  // What to do once the current sheet has finished closing.
  const next = useRef<'pickMeal' | null>(null);
  const pickedMeal = useRef<string | null>(null);

  // Push, never navigate: `+` over an open Quick Calories screen must start a fresh form for the picked meal, not
  // update the open screen's params in place and keep its old meal and input (NAV-03, review M3-R1).
  const openQuickCalories = (mealId: string) => router.push(routes.quickCalories({ mealId, date, origin: 'diary' }));

  return (
    <>
      <AddActionSheet
        visible={open}
        onClose={onClose}
        onQuickCalories={() => {
          next.current = 'pickMeal';
          onClose();
        }}
        onDismissed={() => {
          if (next.current !== 'pickMeal') return;
          next.current = null;
          const list = meals.data ?? [];
          if (list.length === 1) openQuickCalories(list[0]!.id);
          else setPicking(true);
        }}
      />
      <MealPicker
        visible={picking}
        meals={meals.data ?? []}
        onSelect={(mealId) => {
          pickedMeal.current = mealId;
          setPicking(false);
        }}
        onClose={() => {
          pickedMeal.current = null;
          setPicking(false);
        }}
        onDismissed={() => {
          const mealId = pickedMeal.current;
          pickedMeal.current = null;
          if (mealId) openQuickCalories(mealId);
        }}
      />
    </>
  );
}
