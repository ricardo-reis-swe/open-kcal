import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import {
  canHideFoodSearchSection,
  moveFoodSearchSection,
  setFoodSearchSectionVisible,
  type FoodSearchSection,
  type FoodSearchSectionId,
} from '@/domain/food/searchSections';
import { useFoodSearchSections, useSetFoodSearchSections } from '@/features/food-search/food-search.queries';
import { AppText, InlineStatus, SectionHeader } from '@/shared/components';
import { useTheme } from '@/shared/theme';

import { ReorderableSwitchRow, useReorderDragState } from './ReorderableSwitchRow';

const LABEL_KEYS = {
  custom: 'foodSearch.myFoods',
  saved: 'foodSearch.saved',
  open_food_facts: 'foodSearch.openFoodFacts',
  usda: 'foodSearch.usda',
} as const satisfies Record<FoodSearchSectionId, string>;

/**
 * UX-18 `Search results` (DATA-19): the 4 Food Search sections in their saved order. Each switch change or drop saves
 * immediately, as Units. Reorder as UX-17 Meals: handle drag, a11y `Move up` / `Move down` (DS-05). The last visible
 * section's switch is disabled.
 */
export function SearchResultsGroup({ usdaAvailable = true }: { usdaAvailable?: boolean }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const sections = useFoodSearchSections().data;
  const save = useSetFoodSearchSections();
  const [saveFailed, setSaveFailed] = useState(false);
  const drag = useReorderDragState();
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
      {sections.map((section, index) => {
        const available = section.id !== 'usda' || usdaAvailable;
        const locked = section.visible && !canHideFoodSearchSection(sections, section.id);
        return (
          <ReorderableSwitchRow
            key={section.id}
            label={t(LABEL_KEYS[section.id])}
            index={index}
            count={sections.length}
            drag={drag}
            value={available && section.visible}
            disabled={locked || !available}
            hint={!available ? t('foodDatabases.usdaRequiresKey') : locked ? t('foodDatabases.lastVisible') : undefined}
            onToggle={(visible) => commit(setFoodSearchSectionVisible(sections, section.id, visible))}
            onMove={(delta) => commit(moveFoodSearchSection(sections, section.id, index + delta))}
            onDrop={(to) => commit(moveFoodSearchSection(sections, section.id, to))}
            testIDPrefix="search-section"
            rowKey={section.id}
          />
        );
      })}
      {onlyOneVisible ? (
        <AppText variant="compact" color="textSecondary" style={{ paddingTop: theme.spacing[2] }}>
          {t('foodDatabases.lastVisible')}
        </AppText>
      ) : null}
    </View>
  );
}
