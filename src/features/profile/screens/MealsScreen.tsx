import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { type SharedValue, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import type { Meal } from '@/data/db/repositories/mealsRepository';
import { dragShift, dropIndex, moveMeal, moveMealToIndex } from '@/domain/meals/meals';
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
  // UX-17 live preview: the dragged row index, the slot it hovers and its height; other rows shift from these.
  const drag: DragState = {
    active: useSharedValue(-1),
    hover: useSharedValue(-1),
    rowHeight: useSharedValue<number>(theme.sizes.settingsRow[0]),
  };

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
            drag={drag}
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

type DragState = { active: SharedValue<number>; hover: SharedValue<number>; rowHeight: SharedValue<number> };

type RowProps = {
  meal: Meal;
  index: number;
  count: number;
  drag: DragState;
  onPress: () => void;
  onMove: (delta: -1 | 1) => void;
  onDrop: (toIndex: number) => void;
};

const LONG_PRESS_MS = 400;

function MealRow({ meal, index, count, drag, onPress, onMove, onDrop }: RowProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const dragY = useSharedValue(0);
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
        drag.rowHeight.set(height.get());
        drag.hover.set(index);
        drag.active.set(index);
        dropped.set(true);
      })
      .onUpdate((event) => {
        dragY.set(event.translationY);
        drag.hover.set(dropIndex(index, event.translationY, height.get(), count));
      })
      .onEnd((event) => {
        scheduleOnRN(drop, event.translationY);
      })
      .onFinalize(() => {
        drag.active.set(-1);
        drag.hover.set(-1);
        dragY.set(0);
      });
    return longPress ? gesture.activateAfterLongPress(LONG_PRESS_MS) : gesture.minDistance(4);
  };

  const style = useAnimatedStyle(() => {
    const active = drag.active.get();
    const isDragged = active === index;
    const shift = dragShift(index, active, drag.hover.get(), drag.rowHeight.get());
    return {
      // Snap back without animation when the drag ends so the committed order doesn't slide from stale offsets.
      transform: [{ translateY: isDragged ? dragY.get() : active < 0 ? 0 : withTiming(shift, { duration: 150 }) }],
      zIndex: isDragged ? 1 : 0,
      opacity: isDragged ? 0.9 : 1,
    };
  });

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
