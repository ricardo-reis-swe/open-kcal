// Route parameter contracts (NAV-09). Routes carry IDs and lightweight context only.
// Params arriving from the router are untrusted and must be validated (ARCH-03) before use.
// Typed route builders (ARCH-06) are added per route as screens land.
import type { Href } from 'expo-router';
import { z } from 'zod';

import { isLocalDate } from '@/shared/dates';


/** Local calendar date, `YYYY-MM-DD` (DATA-08). */
export type LocalDate = string;
/** Application-generated UUID string (DATA-03). */
export type Uuid = string;

export type Origin = 'diary' | 'mealDetail' | 'profile' | 'weightHistory';
export type FoodSource = 'custom' | 'usda' | 'open_food_facts';

export type RouteParams = {
  diary: { date?: LocalDate };
  mealDetail: { mealId: Uuid; date: LocalDate };
  foodSearch: { mealId: Uuid; date: LocalDate; initialQuery?: string; origin?: Origin };
  foodDetail: { foodId: Uuid; foodSource: FoodSource; mealId: Uuid; date: LocalDate; origin?: Origin };
  editFoodEntry: { entryId: Uuid; origin?: Origin };
  quickCalories: { mealId: Uuid; date: LocalDate; origin?: Origin };
  editQuickCalories: { entryId: Uuid; origin?: Origin };
  createCustomFood: { mealId: Uuid; date: LocalDate; initialName?: string; origin?: Origin };
  mealEdit: { mode: 'create' } | { mode: 'edit'; mealId: Uuid };
  weightEntry: { mode: 'create'; date?: LocalDate } | { mode: 'edit'; weightEntryId: Uuid; date?: LocalDate };
  foodDatabases: undefined;
  caloriesMacros: undefined;
};

export type RouteName = keyof RouteParams;

// ---- Typed route builders (ARCH-06) and param parsers (ARCH-03) ----

const originSchema = z.enum(['diary', 'mealDetail', 'profile', 'weightHistory']);
const idSchema = z.string().min(1);
const dateSchema = z.string().refine(isLocalDate);

/** Router params arrive as strings (or string arrays); anything else is invalid. */
type RawParams = Record<string, string | string[] | undefined>;

const paramSchemas = {
  mealDetail: z.object({ mealId: idSchema, date: dateSchema }),
  foodSearch: z.object({
    mealId: idSchema,
    date: dateSchema,
    initialQuery: z.string().optional(),
    origin: originSchema.default('diary'),
  }),
  foodDetail: z.object({
    foodId: idSchema,
    foodSource: z.enum(['custom', 'usda', 'open_food_facts']),
    mealId: idSchema,
    date: dateSchema,
    origin: originSchema.default('diary'),
  }),
  createCustomFood: z.object({
    mealId: idSchema,
    date: dateSchema,
    initialName: z.string().optional(),
    origin: originSchema.default('diary'),
  }),
  quickCalories: z.object({ mealId: idSchema, date: dateSchema, origin: originSchema.default('diary') }),
  editQuickCalories: z.object({ entryId: idSchema, origin: originSchema.default('diary') }),
  editFoodEntry: z.object({ entryId: idSchema, origin: originSchema.default('diary') }),
  foodDatabases: z.object({}),
  /** NAV-06 Edit Meal (`/profile/meals/[mealId]`); create mode has its own route without params. */
  mealEdit: z.object({ mealId: idSchema }),
};

type ParsedParams = { [K in keyof typeof paramSchemas]: z.output<(typeof paramSchemas)[K]> };

/** Validated params, or `null` for bad params (the screen then shows "no longer exists", UX-00). */
export function parseRouteParams<K extends keyof typeof paramSchemas>(route: K, raw: RawParams): ParsedParams[K] | null {
  const result = paramSchemas[route].safeParse(raw);
  return result.success ? (result.data as ParsedParams[K]) : null;
}

export const routes = {
  diary: (): Href => '/diary',
  profile: (): Href => '/profile',
  foodDatabases: (): Href => '/profile/food-databases' as Href,
  /** NAV-06 / UX-16 (also the Diary's UX-01 `Set goals`, pushed `withAnchor` so the Profile hub sits under it). */
  caloriesMacros: (): Href => '/profile/calories-macros' as Href,
  /** NAV-06 / UX-17 Meals list. */
  meals: (): Href => '/profile/meals' as Href,
  /** NAV-06 Add / Edit Meal: create mode, or edit by `mealId`. */
  mealEdit: (p: RouteParams['mealEdit']): Href =>
    (p.mode === 'create'
      ? '/profile/meals/new'
      : { pathname: '/profile/meals/[mealId]', params: { mealId: p.mealId } }) as unknown as Href,
  /** NAV-04: Meal Detail by `mealId` (never by name) on a diary date. */
  mealDetail: (p: RouteParams['mealDetail']): Href =>
    ({ pathname: '/diary/meal/[mealId]', params: { mealId: p.mealId, date: p.date } }) as unknown as Href,
  foodSearch: (p: RouteParams['foodSearch']): Href => ({
    pathname: '/diary/food-search',
    params: {
      mealId: p.mealId,
      date: p.date,
      ...(p.initialQuery ? { initialQuery: p.initialQuery } : {}),
      origin: p.origin ?? 'diary',
    },
  }) as unknown as Href,
  foodDetail: (p: RouteParams['foodDetail']): Href => ({
    pathname: '/diary/food-detail/[foodId]',
    params: {
      foodId: p.foodId,
      foodSource: p.foodSource,
      mealId: p.mealId,
      date: p.date,
      origin: p.origin ?? 'diary',
    },
  }) as unknown as Href,
  createCustomFood: (p: RouteParams['createCustomFood']): Href => ({
    pathname: '/diary/create-custom-food',
    params: {
      mealId: p.mealId,
      date: p.date,
      ...(p.initialName ? { initialName: p.initialName } : {}),
      origin: p.origin ?? 'diary',
    },
  }) as unknown as Href,
  quickCalories: (p: RouteParams['quickCalories']): Href => ({
    pathname: '/diary/quick-calories',
    params: { mealId: p.mealId, date: p.date, origin: p.origin ?? 'diary' },
  }),
  editQuickCalories: (p: RouteParams['editQuickCalories']): Href => ({
    pathname: '/diary/quick-calories/[entryId]',
    params: { entryId: p.entryId, origin: p.origin ?? 'diary' },
  }),
  editFoodEntry: (p: RouteParams['editFoodEntry']): Href =>
    ({
      pathname: '/diary/food-entry/[entryId]',
      params: { entryId: p.entryId, origin: p.origin ?? 'diary' },
    }) as unknown as Href,
};
