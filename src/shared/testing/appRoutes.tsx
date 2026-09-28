import { renderRouter } from 'expo-router/testing-library';
import { Text } from 'react-native';

import TabsLayout from '@/app/(tabs)/_layout';
import DiaryStackLayout from '@/app/(tabs)/diary/_layout';
import DiaryIndex from '@/app/(tabs)/diary/index';
import CreateCustomFoodRoute from '@/app/(tabs)/diary/create-custom-food';
import FoodDetailRoute from '@/app/(tabs)/diary/food-detail/[foodId]';
import EditFoodEntryRoute from '@/app/(tabs)/diary/food-entry/[entryId]';
import MealDetailRoute from '@/app/(tabs)/diary/meal/[mealId]';
import FoodSearchRoute from '@/app/(tabs)/diary/food-search/index';
import EditQuickCaloriesRoute from '@/app/(tabs)/diary/quick-calories/[entryId]';
import QuickCaloriesRoute from '@/app/(tabs)/diary/quick-calories/index';
import ProfileStackLayout from '@/app/(tabs)/profile/_layout';
import ProfileIndex from '@/app/(tabs)/profile/index';
import CaloriesMacrosRoute from '@/app/(tabs)/profile/calories-macros';
import MealsRoute from '@/app/(tabs)/profile/meals/index';
import AddMealRoute from '@/app/(tabs)/profile/meals/new';
import EditMealRoute from '@/app/(tabs)/profile/meals/[mealId]';
import UnitsRoute from '@/app/(tabs)/profile/units';
import WeightGoalRoute from '@/app/(tabs)/profile/weight-goal';
import WeightHistoryRoute from '@/app/(tabs)/profile/weight-history';
import RootLayout from '@/app/_layout';
import Index from '@/app/index';

/** The real route tree for Expo Router in-memory tests (ARCH-18), plus optional extra mock routes. */
export function appRoutes(extra: Record<string, () => React.ReactElement> = {}) {
  return {
    _layout: RootLayout,
    index: Index,
    '(tabs)/_layout': TabsLayout,
    '(tabs)/diary/_layout': DiaryStackLayout,
    '(tabs)/diary/index': DiaryIndex,
    '(tabs)/diary/meal/[mealId]': MealDetailRoute,
    '(tabs)/diary/food-search/index': FoodSearchRoute,
    '(tabs)/diary/food-detail/[foodId]': FoodDetailRoute,
    '(tabs)/diary/food-entry/[entryId]': EditFoodEntryRoute,
    '(tabs)/diary/create-custom-food': CreateCustomFoodRoute,
    '(tabs)/diary/quick-calories/index': QuickCaloriesRoute,
    '(tabs)/diary/quick-calories/[entryId]': EditQuickCaloriesRoute,
    '(tabs)/profile/_layout': ProfileStackLayout,
    '(tabs)/profile/index': ProfileIndex,
    '(tabs)/profile/calories-macros': CaloriesMacrosRoute,
    '(tabs)/profile/meals/index': MealsRoute,
    '(tabs)/profile/meals/new': AddMealRoute,
    '(tabs)/profile/meals/[mealId]': EditMealRoute,
    '(tabs)/profile/units': UnitsRoute,
    '(tabs)/profile/weight-goal': WeightGoalRoute,
    '(tabs)/profile/weight-history': WeightHistoryRoute,
    ...extra,
  };
}

/** A deeper stack screen used to test stack behavior before real deeper screens exist. */
export function MockDeepScreen() {
  return <Text>Deep screen</Text>;
}

/**
 * Renders the real app at `initialUrl`. RNTL 14's `render` is async, so the router's `getPathname()` lives on the
 * un-awaited result; this keeps it reachable (the `toHavePathname` matcher can't see it through `screen`).
 */
export async function renderApp(initialUrl: string, extra: Record<string, () => React.ReactElement> = {}) {
  const result = renderRouter(appRoutes(extra), { initialUrl });
  await result;
  return { getPathname: () => result.getPathname() };
}
