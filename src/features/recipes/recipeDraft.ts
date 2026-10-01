// UX-26 recipe draft: held in memory for the editor and its Ingredient Search / Detail screens until Save, never
// written to SQLite before then. Keyed by a draft id passed in route params, so it works in either stack (NAV-02).
import { useSyncExternalStore } from 'react';

import type { Food } from '@/data/db/repositories/foodsRepository';
import type { IngredientAmount } from '@/domain/food/recipe';

export type DraftIngredient = {
  /** Stable key within the draft (the stored ingredient id, or a new one). */
  key: string;
  food: Food;
  /** `null` when an existing ingredient's serving is gone; its snapshot factor then applies (DATA-27). */
  servingId: string | null;
  quantity: number;
  /** The serving's label at the time it was chosen, or the stored snapshot. */
  servingUnit: string;
  basisMultiplierSnapshot: number;
};

export type RecipeDraft = { recipeName: string; ingredients: DraftIngredient[] };

const drafts = new Map<string, RecipeDraft>();
const listeners = new Set<() => void>();
let counter = 0;

const emit = () => listeners.forEach((listener) => listener());

export function createRecipeDraft(initial: RecipeDraft): string {
  counter += 1;
  const id = `draft-${Date.now()}-${counter}`;
  drafts.set(id, initial);
  return id;
}

export function getRecipeDraft(id: string): RecipeDraft | undefined {
  return drafts.get(id);
}

export function discardRecipeDraft(id: string): void {
  if (drafts.delete(id)) emit();
}

function update(id: string, change: (draft: RecipeDraft) => RecipeDraft) {
  const draft = drafts.get(id);
  if (!draft) return;
  drafts.set(id, change(draft));
  emit();
}

export function setDraftRecipeName(id: string, recipeName: string): void {
  if (drafts.get(id)?.recipeName === recipeName) return;
  update(id, (draft) => ({ ...draft, recipeName }));
}

/** Ingredient Detail `Add` (new key → appended) or `Save` (existing key → replaced in place). */
export function putDraftIngredient(id: string, ingredient: DraftIngredient): void {
  update(id, (draft) => {
    const index = draft.ingredients.findIndex((item) => item.key === ingredient.key);
    const ingredients = [...draft.ingredients];
    if (index < 0) ingredients.push(ingredient);
    else ingredients[index] = ingredient;
    return { ...draft, ingredients };
  });
}

export function removeDraftIngredient(id: string, key: string): void {
  update(id, (draft) => ({ ...draft, ingredients: draft.ingredients.filter((item) => item.key !== key) }));
}

export function newIngredientKey(): string {
  counter += 1;
  return `new-${Date.now()}-${counter}`;
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function useRecipeDraft(id: string | undefined): RecipeDraft | undefined {
  return useSyncExternalStore(
    subscribe,
    () => (id ? drafts.get(id) : undefined),
    () => (id ? drafts.get(id) : undefined),
  );
}

/** DATA-27 math input for one draft ingredient: the current serving multiplier if it still resolves. */
export function draftIngredientAmount(ingredient: DraftIngredient): IngredientAmount {
  const serving = ingredient.servingId
    ? ingredient.food.servings.find((item) => item.id === ingredient.servingId)
    : undefined;
  return {
    food: ingredient.food,
    servingBasisMultiplier: serving?.basisMultiplier ?? null,
    quantity: ingredient.quantity,
    basisMultiplierSnapshot: ingredient.basisMultiplierSnapshot,
  };
}
