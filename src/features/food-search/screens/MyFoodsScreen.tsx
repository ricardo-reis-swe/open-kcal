import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import type { Food } from '@/data/db/repositories/foodsRepository';
import { useAppSettings, useMeals } from '@/features/diary/diary.queries';
import { AppBar, AppText, InlineStatus, TextAction, UndoToast } from '@/shared/components';
import { useFormattingLocale } from '@/shared/i18n/useFormattingLocale';
import { MealPicker } from '@/shared/navigation/MealPicker';
import { useTheme } from '@/shared/theme';

import { clearAddedFood, useAddedFoodNotice } from '../addedNotice';
import { FoodResultRow } from '../components/FoodResultRow';
import { useCustomFoodList, useLocalFoodWrites } from '../food-search.queries';

type Props = {
  onBack: () => void;
  /** UX-25: after the Meal Picker, Food Detail (add) for this food and meal on the Diary's selected date. */
  onOpenFood: (food: Food, mealId: string) => void;
};

/** UX-25 / NAV-06 My foods: every custom food (DATA-25); tap → Meal Picker → Food Detail; swipe → Delete + Undo. */
export function MyFoodsScreen({ onBack, onOpenFood }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const locale = useFormattingLocale();
  const settings = useAppSettings();
  const meals = useMeals();
  const writes = useLocalFoodWrites();
  const [pages, setPages] = useState(1);
  const list = useCustomFoodList(pages);
  const [picking, setPicking] = useState(false);
  // The sheet closes fully before the route opens (NAV-03), so the choice waits in refs until `onDismissed`.
  const pickingFood = useRef<Food | null>(null);
  const pickedMeal = useRef<string | null>(null);
  const [deletedFood, setDeletedFood] = useState<Food | null>(null);
  const [deleteFailed, setDeleteFailed] = useState(false);
  const added = useAddedFoodNotice();
  useEffect(() => () => void (added && clearAddedFood(added.key)), [added]);

  const open = (food: Food) => {
    const options = meals.data ?? [];
    // UX-10: with exactly one meal the picker is skipped.
    if (options.length === 1) onOpenFood(food, options[0]!.id);
    else {
      pickingFood.current = food;
      setPicking(true);
    }
  };
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
      <AppBar title={t('myFoods.title')} back={{ label: t('common.back'), onPress: onBack }} />
      {settings.data && list.isSuccess ? (
        <ScrollView contentContainerStyle={{ paddingBottom: theme.spacing[6] }} testID="my-foods">
          {deleteFailed ? (
            <View style={{ padding: theme.spacing[4] }}>
              <InlineStatus tone="error" message={t('foodSearch.deleteError')} />
            </View>
          ) : null}
          {foods.length === 0 ? (
            <AppText color="textSecondary" style={{ padding: theme.spacing[4] }}>
              {t('myFoods.empty')}
            </AppText>
          ) : (
            foods.map((food) => (
              <FoodResultRow
                key={food.id}
                food={food}
                locale={locale}
                energyUnit={settings.data.energyUnit}
                onPress={() => open(food)}
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
          const food = pickingFood.current;
          pickedMeal.current = null;
          pickingFood.current = null;
          if (mealId && food) onOpenFood(food, mealId);
        }}
      />
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
      {added && !deletedFood ? (
        <UndoToast
          key={added.key}
          message={t('foodSearch.added', { name: added.foodName, meal: added.mealName })}
          onDismiss={() => clearAddedFood(added.key)}
          testID="food-added-toast"
        />
      ) : null}
    </View>
  );
}
