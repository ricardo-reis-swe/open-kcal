import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { RecipeEditorScreen } from '@/features/recipes/screens/RecipeEditorScreen';
import { NotFoundState } from '@/shared/components';
import { parseRouteParams, routes } from '@/shared/navigation/routes';

/** NAV-04 Create Recipe (UX-26): Save replaces itself with Food Detail for the recipe; nothing is logged. */
export default function CreateRecipeRoute() {
  const { t } = useTranslation();
  const params = parseRouteParams('createRecipe', useLocalSearchParams());
  if (!params)
    return <NotFoundState actionLabel={t('common.backToDiary')} onAction={() => router.dismissTo(routes.diary())} />;
  return (
    <RecipeEditorScreen
      initialName={params.initialName}
      onCancel={() => router.back()}
      onSaved={(food) =>
        router.replace(
          routes.foodDetail({
            foodId: food.id,
            foodSource: food.source,
            mealId: params.mealId,
            date: params.date,
            origin: params.origin,
          }),
        )
      }
      onAddIngredient={(draftId) => router.push(routes.ingredientSearch({ stack: 'diary', draftId }))}
      onEditIngredient={(draftId, ingredient) =>
        router.push(
          routes.ingredientDetail({
            stack: 'diary',
            draftId,
            foodId: ingredient.food.id,
            foodSource: ingredient.food.source,
            ingredientKey: ingredient.key,
          }),
        )
      }
    />
  );
}
