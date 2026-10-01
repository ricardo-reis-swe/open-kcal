import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useDiaryDate } from '@/features/diary/hooks/DiaryDateContext';
import { FoodDetailScreen } from '@/features/food-search/screens/FoodDetailScreen';
import { FoodSearchScreen } from '@/features/food-search/screens/FoodSearchScreen';
import { NotFoundState } from '@/shared/components';
import { parseRouteParams, routes, type RecipeStack } from '@/shared/navigation/routes';

import { useRecipeDraft } from '../recipeDraft';

const noop = () => {};

/** NAV-04 Ingredient Search (UX-04 ingredient mode) over a UX-26 editor in `stack`. Back → the editor. */
export function IngredientSearchRoute({ stack }: { stack: RecipeStack }) {
  const { t } = useTranslation();
  const params = parseRouteParams('ingredientSearch', useLocalSearchParams());
  const draft = useRecipeDraft(params?.draftId);
  const { today } = useDiaryDate();
  if (!params || !draft) return <NotFoundState actionLabel={t('common.back')} onAction={() => router.back()} />;
  const open = (foodId: string, foodSource: 'custom' | 'usda' | 'open_food_facts', externalId?: string) =>
    router.push(routes.ingredientDetail({ stack, draftId: params.draftId, foodId, foodSource, externalId }));
  return (
    <FoodSearchScreen
      mealId=""
      date={today}
      today={today}
      ingredientFor={{ recipeName: draft.recipeName }}
      onBack={() => router.back()}
      onScan={noop}
      onQuickCalories={noop}
      onCreateCustom={noop}
      onAddedSelection={noop}
      onSelectFood={(food) => open(food.id, food.source)}
      onSelectExternal={(source, externalId) => open(externalId, source, externalId)}
    />
  );
}

/** NAV-04 Ingredient Detail (UX-05 ingredient mode). Add pops Ingredient Search too; Save (edit) pops itself. */
export function IngredientDetailRoute() {
  const params = parseRouteParams('ingredientDetail', useLocalSearchParams());
  return (
    <FoodDetailScreen
      mode={
        params
          ? {
              kind: 'ingredient',
              ...params,
              onDone: () => (params.ingredientKey ? router.back() : router.dismiss(2)),
            }
          : null
      }
    />
  );
}
