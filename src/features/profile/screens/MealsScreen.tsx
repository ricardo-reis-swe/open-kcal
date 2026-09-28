import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import type { Meal } from '@/data/db/repositories/mealsRepository';
import { dropIndex, moveMeal, moveMealToIndex } from '@/domain/meals/meals';
import { useMeals } from '@/features/diary/diary.queries';
import { AppBar, AppIcon, AppText, FocusablePressable, InlineStatus, TextAction } from '@/shared/components';
import { useTheme } from '@/shared/theme';

import { useMealWrites } from '../profile.queries';

type Props = {
  onBack: () => void;
  onAddMeal: () => void;
  onEditMeal: (mealId: string) => void;
};

/**
 * UX-17 / NAV-06 Meals: rows in saved order with a drag handle. A handle drag or a long-press drag reorders and
 * commits on drop (one transaction, DATA-10); a11y `Move up` / `Move down` are the gesture alternative (DS-05).
 * No Save button. Row tap → Edit Meal; last row `+ Add meal`.
 */
export function MealsScreen({ onBack, onAddMeal, onEditMeal }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const meals = useMeals().data;
  const { reorder } = useMealWrites();
  const [saveFailed, setSaveFailed] = useState(false);

  const commit = (next: string[] | null) => {
    if (!next || reorder.isPending) return;
    setSaveFailed(false);
    reorder.mutate(next, { onError: () => setSaveFailed(true) });
  };
  const ids = meals?.map((m) => m.id) ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.canvas }}>
      <AppBar title={t('meals.title')} back={{ label: t('common.back'), onPress: onBack }} />
      <ScrollView contentContainerStyle={{ paddingBottom: theme.spacing[8] }}>
        {saveFailed ? (
          <View style={{ padding: theme.spacing[4] }}>
            <InlineStatus tone="error" message={t('meals.saveError')} testID="meals-save-error" />
          </View>
        ) : null}
        {meals?.map((meal, index) => (
          <MealRow
            key={meal.id}
            meal={meal}
            index={index}
            count={meals.length}
            onPress={() => onEditMeal(meal.id)}
            onMove={(delta) => commit(moveMeal(ids, meal.id, delta))}
            onDrop={(to) => commit(moveMealToIndex(ids, meal.id, to))}
          />
        ))}
        {meals ? (
          <View style={{ paddingHorizontal: theme.spacing[2], backgroundColor: theme.colors.surface }}>
            <TextAction label={t('meals.addMeal')} icon="add" onPress={onAddMeal} testID="meals-add" />
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

type RowProps = {
  meal: Meal;
  index: number;
  count: number;
  onPress: () => void;
  onMove: (delta: -1 | 1) => void;
  onDrop: (toIndex: number) => void;
};

const LONG_PRESS_MS = 400;

function MealRow({ meal, index, count, onPress, onMove, onDrop }: RowProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const dragY = useSharedValue(0);
  const dragging = useSharedValue(0);
  const height = useSharedValue<number>(theme.sizes.settingsRow[0]);
  // A long-press drag ends with a touch release on the row; that release must not also open Edit Meal.
  const dropped = useSharedValue(false);

  const drop = (translationY: number) => {
    const to = dropIndex(index, translationY, height.get(), count);
    if (to !== index) onDrop(to);
  };

  const pan = (testId: string, longPress: boolean) => {
    const gesture = Gesture.Pan()
      .withTestId(testId)
      .onStart(() => {
        dragging.set(1);
        dropped.set(true);
      })
      .onUpdate((event) => {
        dragY.set(event.translationY);
      })
      .onEnd((event) => {
        scheduleOnRN(drop, event.translationY);
      })
      .onFinalize(() => {
        dragging.set(0);
        dragY.set(0);
      });
    return longPress ? gesture.activateAfterLongPress(LONG_PRESS_MS) : gesture.minDistance(4);
  };

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: dragY.get() }],
    zIndex: dragging.get() ? 1 : 0,
    opacity: dragging.get() ? 0.9 : 1,
  }));

  const actions = [
    ...(index > 0 ? [{ name: 'moveUp', label: t('meals.moveUp') }] : []),
    ...(index < count - 1 ? [{ name: 'moveDown', label: t('meals.moveDown') }] : []),
  ];

  return (
    <Animated.View
      style={style}
      onLayout={(event) => {
        height.set(event.nativeEvent.layout.height);
      }}
    >
      <View
        style={[
          styles.row,
          {
            minHeight: theme.sizes.settingsRow[0],
            backgroundColor: theme.colors.surface,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: theme.colors.divider,
          },
        ]}
      >
        <GestureDetector gesture={pan(`meals-row-pan-${index}`, true)}>
          <FocusablePressable
            onPress={() => {
              if (dropped.get()) return;
              onPress();
            }}
            onPressIn={() => {
              dropped.set(false);
            }}
            accessibilityRole="button"
            accessibilityLabel={meal.name}
            accessibilityActions={actions}
            onAccessibilityAction={(event) => {
              if (event.nativeEvent.actionName === 'moveUp') onMove(-1);
              if (event.nativeEvent.actionName === 'moveDown') onMove(1);
            }}
            testID={`meals-row-${index}`}
            style={({ pressed }) => [
              styles.label,
              {
                minHeight: theme.sizes.settingsRow[0],
                paddingLeft: theme.spacing[4],
                justifyContent: 'center',
                backgroundColor: pressed ? theme.colors.primaryTint : undefined,
              },
            ]}
          >
            <AppText variant="body" numberOfLines={2}>
              {meal.name}
            </AppText>
          </FocusablePressable>
        </GestureDetector>
        {/* Touch affordance only (testID kept for Maestro); screen readers reorder via the row's move actions. */}
        <GestureDetector gesture={pan(`meals-handle-pan-${index}`, false)}>
          <View
            testID={`meals-handle-${index}`}
            style={[styles.handle, { minWidth: theme.touchMin, minHeight: theme.touchMin }]}
          >
            <AppIcon name="reorder-three-outline" color="textSecondary" />
          </View>
        </GestureDetector>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  label: { flex: 1 },
  handle: { alignItems: 'center', justifyContent: 'center' },
});
