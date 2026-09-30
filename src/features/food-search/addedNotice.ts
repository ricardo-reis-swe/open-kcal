// NAV-04: after Food Detail adds an entry it returns to Food Search, which confirms the add with a DS-10 toast.
// Screens hand the notice over through this tiny store, since `router.back()` carries no result.
import { useSyncExternalStore } from 'react';

export type AddedNotice = { key: number; foodName: string; mealName: string };

let notice: AddedNotice | null = null;
let nextKey = 0;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((listener) => listener());

export function announceAddedFood(foodName: string, mealName: string): void {
  nextKey += 1;
  notice = { key: nextKey, foodName, mealName };
  emit();
}

export function clearAddedFood(key: number): void {
  if (notice?.key !== key) return;
  notice = null;
  emit();
}

export function useAddedFoodNotice(): AddedNotice | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => notice,
  );
}
