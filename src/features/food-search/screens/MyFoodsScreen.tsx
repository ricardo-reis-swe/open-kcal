import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import type { Food } from '@/data/db/repositories/foodsRepository';
import { useAppSettings } from '@/features/diary/diary.queries';
import { AppBar, AppText, InlineStatus, TextAction, UndoToast } from '@/shared/components';
import { useFormattingLocale } from '@/shared/i18n/useFormattingLocale';
import { useTheme } from '@/shared/theme';

import { FoodResultRow } from '../components/FoodResultRow';
import { useCustomFoodList, useLocalFoodWrites, useRecipeList } from '../food-search.queries';

type Props = {
  onBack: () => void;
  /** UX-25: the food's details, editable (UX-08 edit mode); UX-27: the recipe editor (UX-26 edit mode). */
  onOpenFood: (food: Food) => void;
  /** UX-27 My recipes lists recipes (DATA-28) with the same rows and swipe-delete. */
  variant?: 'foods' | 'recipes';
};

/** UX-25 / NAV-06 My foods (UX-27 My recipes): DATA-25/28 order; tap → details/edit; swipe → Delete + Undo. */
export function MyFoodsScreen({ onBack, onOpenFood, variant = 'foods' }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const locale = useFormattingLocale();
  const settings = useAppSettings();
  const writes = useLocalFoodWrites();
  const [pages, setPages] = useState(1);
  const recipes = variant === 'recipes';
  const customList = useCustomFoodList(pages, !recipes);
  const recipeList = useRecipeList(pages, recipes);
  const list = recipes ? recipeList : customList;
  const strings = recipes ? 'myRecipes' : 'myFoods';
  const [deletedFood, setDeletedFood] = useState<Food | null>(null);
  const [deleteFailed, setDeleteFailed] = useState(false);
  const deleteFood = async (food: Food): Promise<boolean> => {
    setDeleteFailed(false);
    try {
      await writes.deleteFood.mutateAsync(food.id);
      setDeletedFood(food);
      return true;
    } catch {
      setDeleteFailed(true);
      return false;
    }
  };
  const undoDelete = async () => {
    if (!deletedFood) return;
    try {
      await writes.restoreFood.mutateAsync(deletedFood.id);
    } catch {
      setDeleteFailed(true);
    }
    setDeletedFood(null);
  };
  const foods = list.data ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.canvas }}>
      <AppBar title={t(`${strings}.title`)} back={{ label: t('common.back'), onPress: onBack }} />
      {settings.data && list.isSuccess ? (
        <ScrollView
          contentContainerStyle={{ paddingBottom: theme.spacing[6] }}
          testID={recipes ? 'my-recipes' : 'my-foods'}
        >
          {deleteFailed ? (
            <View style={{ padding: theme.spacing[4] }}>
              <InlineStatus tone="error" message={t('foodSearch.deleteError')} />
            </View>
          ) : null}
          {foods.length === 0 ? (
            <AppText color="textSecondary" style={{ padding: theme.spacing[4] }}>
              {t(`${strings}.empty`)}
            </AppText>
          ) : (
            foods.map((food) => (
              <FoodResultRow
                key={food.id}
                food={food}
                locale={locale}
                energyUnit={settings.data.energyUnit}
                onPress={() => onOpenFood(food)}
                onDelete={() => deleteFood(food)}
              />
            ))
          )}
          {foods.length === pages * 20 ? (
            <TextAction
              icon="add"
              label={t('foodSearch.showMore')}
              onPress={() => setPages((current) => current + 1)}
              testID="my-foods-show-more"
            />
          ) : null}
        </ScrollView>
      ) : null}
      {deletedFood ? (
        <UndoToast
          key={deletedFood.id}
          message={t('foodSearch.deleted', { name: deletedFood.name })}
          undoLabel={t('common.undo')}
          onUndo={() => void undoDelete()}
          onDismiss={() => setDeletedFood(null)}
          testID="food-delete-undo"
        />
      ) : null}
    </View>
  );
}
