// Route parameter contracts (NAV-09). Routes carry IDs and lightweight context only.
// Params arriving from the router are untrusted and must be validated (ARCH-03) before use.
// Typed route builders (ARCH-06) are added per route as screens land.

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
};

export type RouteName = keyof RouteParams;
