import { router, usePathname } from 'expo-router';
import { useRef, useState } from 'react';

import { AddActionSheet } from '@/shared/navigation/AddActionSheet';
import { MealPicker } from '@/shared/navigation/MealPicker';
import { routes } from '@/shared/navigation/routes';
import { useOpenWeightEntry } from '@/features/profile/hooks/WeightEntryContext';

import { useMeals } from '../diary.queries';
import { useDiaryDate } from '../hooks/DiaryDateContext';

type Props = { open: boolean; onClose: () => void };
type MealFlow = 'pickFoodMeal' | 'pickScanMeal' | 'pickQuickMeal';

/**
 * `+` flows (NAV-03), from either tab: Add Action Sheet → Meal Picker → the flow's screen on the selected diary date.
 * Each sheet closes fully before the next sheet or route opens. With exactly one meal the picker is skipped (UX-10).
 */
export function GlobalAddFlow({ open, onClose }: Props) {
  const { date } = useDiaryDate();
  const pathname = usePathname();
  const meals = useMeals();
  const [picking, setPicking] = useState(false);
  // What to do once the current sheet has finished closing.
  const next = useRef<MealFlow | 'weight' | null>(null);
  const openWeightEntry = useOpenWeightEntry();
  const pickedMeal = useRef<string | null>(null);

  // Push, never navigate: `+` over an open Quick Calories screen must start a fresh form for the picked meal, not
  // update the open screen's params in place and keep its old meal and input (NAV-03, review M3-R1).
  const openQuickCalories = (mealId: string) =>
    router.push(routes.quickCalories({ mealId, date, origin: pathname.startsWith('/profile') ? 'profile' : 'diary' }));
  const openFoodSearch = (mealId: string) =>
    router.push(routes.foodSearch({ mealId, date, origin: pathname.startsWith('/profile') ? 'profile' : 'diary' }));
  // NAV-03 Scan Barcode: Food Search (field not focused) with the scanner on top, so every outcome lands on search.
  const openScanner = (mealId: string) => {
    const origin = pathname.startsWith('/profile') ? 'profile' : 'diary';
    router.push(routes.foodSearch({ mealId, date, scan: true, origin }));
    router.push(routes.barcodeScanner({ mealId, date, origin }));
  };
  const openMealFlow = (kind: MealFlow, mealId: string) => {
    if (kind === 'pickFoodMeal') openFoodSearch(mealId);
    else if (kind === 'pickScanMeal') openScanner(mealId);
    else openQuickCalories(mealId);
  };

  const beginMealFlow = (kind: MealFlow | 'weight') => {
    next.current = kind;
    onClose();
  };

  return (
    <>
      <AddActionSheet
        visible={open}
        onClose={onClose}
        onAddFood={() => beginMealFlow('pickFoodMeal')}
        onScanBarcode={() => beginMealFlow('pickScanMeal')}
        onQuickCalories={() => beginMealFlow('pickQuickMeal')}
        // NAV-03: Update weight → Weight Entry Sheet, defaulting to today (not the diary date).
        onUpdateWeight={() => beginMealFlow('weight')}
        onDismissed={() => {
          const kind = next.current;
          if (!kind) return;
          next.current = null;
          if (kind === 'weight') {
            openWeightEntry({ mode: 'create' });
            return;
          }
          const list = meals.data ?? [];
          if (list.length === 1) openMealFlow(kind, list[0]!.id);
          else {
            next.current = kind;
            setPicking(true);
          }
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
          const kind = next.current;
          pickedMeal.current = null;
          next.current = null;
          if (mealId && kind && kind !== 'weight') openMealFlow(kind, mealId);
        }}
      />
    </>
  );
}
