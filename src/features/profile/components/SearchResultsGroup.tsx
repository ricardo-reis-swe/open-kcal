import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Switch, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { type SharedValue, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import {
  canHideFoodSearchSection,
  moveFoodSearchSection,
  setFoodSearchSectionVisible,
  type FoodSearchSection,
  type FoodSearchSectionId,
  type FoodSearchSections,
} from '@/domain/food/searchSections';
import { dragShift, dropIndex, dropTarget } from '@/domain/meals/meals';
import { useFoodSearchSections, useSetFoodSearchSections } from '@/features/food-search/food-search.queries';
import { AppIcon, AppText, InlineStatus, SectionHeader } from '@/shared/components';
import { useTheme } from '@/shared/theme';

const LABEL_KEYS = {
  custom: 'foodSearch.myFoods',
  saved: 'foodSearch.saved',
  open_food_facts: 'foodSearch.openFoodFacts',
  usda: 'foodSearch.usda',
} as const satisfies Record<FoodSearchSectionId, string>;

type DragState = { active: SharedValue<number>; hover: SharedValue<number>; rowHeight: SharedValue<number> };

/**
 * UX-18 `Search results` (DATA-19): the 4 Food Search sections in their saved order. Each switch change or drop saves
 * immediately, as Units. Reorder as UX-17 Meals: handle drag, a11y `Move up` / `Move down` (DS-05). The last visible
 * section's switch is disabled.
 */
export function SearchResultsGroup() {
  const { t } = useTranslation();
  const theme = useTheme();
  const sections = useFoodSearchSections().data;
  const save = useSetFoodSearchSections();
  const [saveFailed, setSaveFailed] = useState(false);
  const drag: DragState = {
    active: useSharedValue(-1),
    hover: useSharedValue(-1),
    rowHeight: useSharedValue<number>(theme.sizes.settingsRow[0]),
  };
  if (!sections) return null;

  const commit = (next: FoodSearchSection[] | null) => {
    if (!next || save.isPending) return;
    setSaveFailed(false);
    save.mutate(next, { onError: () => setSaveFailed(true) });
  };
  const onlyOneVisible = sections.filter((s) => s.visible).length === 1;

  return (
    <View testID="search-results-group">
      <SectionHeader label={t('foodDatabases.searchResults')} uppercase />
      {saveFailed ? <InlineStatus tone="error" message={t('foodDatabases.sectionsSaveError')} /> : null}
      {sections.map((section, index) => (
        <SectionRow
          key={section.id}
          sections={sections}
          section={section}
          index={index}
          drag={drag}
          onToggle={(visible) => commit(setFoodSearchSectionVisible(sections, section.id, visible))}
          onMove={(delta) => commit(moveFoodSearchSection(sections, section.id, index + delta))}
          onDrop={(to) => commit(moveFoodSearchSection(sections, section.id, to))}
        />
      ))}
      {onlyOneVisible ? (
        <AppText variant="compact" color="textSecondary" style={{ paddingTop: theme.spacing[2] }}>
          {t('foodDatabases.lastVisible')}
        </AppText>
      ) : null}
    </View>
  );
}

type RowProps = {
  sections: FoodSearchSections;
  section: FoodSearchSection;
  index: number;
  drag: DragState;
  onToggle: (visible: boolean) => void;
  onMove: (delta: -1 | 1) => void;
  onDrop: (toIndex: number) => void;
};

function SectionRow({ sections, section, index, drag, onToggle, onMove, onDrop }: RowProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const count = sections.length;
  const dragY = useSharedValue(0);
  const height = useSharedValue<number>(theme.sizes.settingsRow[0]);
  const label = t(LABEL_KEYS[section.id]);
  const locked = section.visible && !canHideFoodSearchSection(sections, section.id);

  const pan = Gesture.Pan()
    .withTestId(`search-section-handle-pan-${index}`)
    .minDistance(4)
    .onStart(() => {
      drag.rowHeight.set(height.get());
      drag.hover.set(index);
      drag.active.set(index);
    })
    .onUpdate((event) => {
      dragY.set(event.translationY);
      drag.hover.set(dropIndex(index, event.translationY, height.get(), count));
    })
    // As UX-17 Meals: commit on finalize so a release outside the list still drops on the last previewed slot.
    .onFinalize(() => {
      const to = drag.active.get() === index ? dropTarget(index, drag.hover.get(), count) : null;
      if (to !== null) scheduleOnRN(onDrop, to);
      drag.active.set(-1);
      drag.hover.set(-1);
      dragY.set(0);
    });

  const style = useAnimatedStyle(() => {
    const active = drag.active.get();
    const isDragged = active === index;
    const shift = dragShift(index, active, drag.hover.get(), drag.rowHeight.get());
    return {
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
    <Animated.View style={style} onLayout={(event) => height.set(event.nativeEvent.layout.height)}>
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
        <View
          accessible
          accessibilityLabel={label}
          accessibilityActions={actions}
          onAccessibilityAction={(event) => {
            if (event.nativeEvent.actionName === 'moveUp') onMove(-1);
            if (event.nativeEvent.actionName === 'moveDown') onMove(1);
          }}
          testID={`search-section-row-${section.id}`}
          style={[styles.label, { paddingLeft: theme.spacing[4] }]}
        >
          <AppText variant="body">{label}</AppText>
        </View>
        <Switch
          value={section.visible}
          disabled={locked}
          onValueChange={onToggle}
          accessibilityLabel={label}
          accessibilityHint={locked ? t('foodDatabases.lastVisible') : undefined}
          trackColor={{ true: theme.colors.primary, false: theme.colors.divider }}
          testID={`search-section-switch-${section.id}`}
        />
        {/* Touch affordance only; screen readers reorder via the row's move actions. */}
        <GestureDetector gesture={pan}>
          <View
            testID={`search-section-handle-${index}`}
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
  label: { flex: 1, justifyContent: 'center' },
  handle: { alignItems: 'center', justifyContent: 'center' },
});
