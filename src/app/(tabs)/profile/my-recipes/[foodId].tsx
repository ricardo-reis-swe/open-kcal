import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { Recipe } from '@/data/db/repositories/recipesRepository';
import { useRecipe } from '@/features/food-search/food-search.queries';
import { RecipeEditorScreen } from '@/features/recipes/screens/RecipeEditorScreen';
import { NotFoundState } from '@/shared/components';
import { parseRouteParams, routes } from '@/shared/navigation/routes';

/** NAV-06 Edit Recipe (UX-26 edit mode). Save, delete and back return to My recipes. */
export default function EditRecipeRoute() {
  const { t } = useTranslation();
  const params = parseRouteParams('editRecipe', useLocalSearchParams());
  const recipe = useRecipe(params?.foodId ?? '', Boolean(params));
  // The editor keeps the recipe it opened with: the refetch after its own save or delete must not swap the form.
  const [opened, setOpened] = useState<Recipe | null>(null);
  const valid = recipe.data && !recipe.data.food.isDeleted;
  if (!opened && valid) setOpened(recipe.data!);
  if (opened)
    return (
      <RecipeEditorScreen
        recipe={opened}
        onCancel={() => router.back()}
        onSaved={() => router.back()}
        onDeleted={() => router.back()}
        onAddIngredient={(draftId) => router.push(routes.ingredientSearch({ stack: 'profile', draftId }))}
        onEditIngredient={(draftId, ingredient) =>
          router.push(
            routes.ingredientDetail({
              stack: 'profile',
              draftId,
              foodId: ingredient.food.id,
              foodSource: ingredient.food.source,
              ingredientKey: ingredient.key,
            }),
          )
        }
      />
    );
  if (!params || recipe.isError || (recipe.data && !valid))
    return (
      <NotFoundState actionLabel={t('common.backToProfile')} onAction={() => router.dismissTo(routes.profile())} />
    );
  return null;
}
