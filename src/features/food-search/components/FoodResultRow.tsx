import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import type { Food } from '@/data/db/repositories/foodsRepository';
import { AppIcon, AppText, SwipeToDelete } from '@/shared/components';
import { FocusablePressable } from '@/shared/components/FocusablePressable';
import { formatEnergy } from '@/shared/i18n/format';
import { useTheme } from '@/shared/theme';

/**
 * DS-09 food result row (UX-04, UX-25): name, brand or basis, source, kcal; optional swipe-revealed Delete. In UX-04
 * select mode `selected` is set (tint + trailing check, a11y `selected`) and unselectable remote rows are `dimmed`.
 */
export function FoodResultRow({
  food,
  locale,
  energyUnit,
  onPress,
  onDelete,
  disabled = false,
  selected,
  dimmed = false,
}: {
  food: Food;
  locale: string;
  energyUnit: 'kcal' | 'kJ';
  onPress: () => void;
  /** Revealed Delete button tap. Resolving `false` (the delete failed) closes the row again. */
  onDelete?: () => Promise<boolean>;
  disabled?: boolean;
  /** UX-04 select mode only; undefined outside it. */
  selected?: boolean;
  /** UX-04 select mode: a remote row that can't be selected (inert). */
  dimmed?: boolean;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  // UX-04 / UX-27: a recipe reads `per serving · Recipe` (DATA-27 stores it per 1 serving).
  const recipe = food.kind === 'recipe';
  const basis = recipe
    ? t('foodSearch.perServing')
    : food.brand || t('foodSearch.perBasis', { quantity: food.basisQuantity, unit: food.basisUnit });
  const sourceLabel = t(recipe ? 'foodSearch.sources.recipe' : `foodSearch.sources.${food.source}`);
  const energy = t('foodSearch.energy', {
    value: formatEnergy(food.nutrients.energyKcal, energyUnit, locale),
    unit: t(`diary.units.${energyUnit}`),
  });
  const energyValue = formatEnergy(food.nutrients.energyKcal, energyUnit, locale);
  const energyUnitLabel = t(`diary.units.${energyUnit}`);
  return (
    <SwipeToDelete testID={`food-swipe-${food.id}`} label={t('common.delete')} onDelete={onDelete}>
      <FocusablePressable
        accessibilityRole="button"
        accessibilityLabel={`${food.name}, ${basis}, ${energy}`}
        accessibilityActions={onDelete ? [{ name: 'delete', label: t('foodSearch.deleteFood') }] : undefined}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'delete') onDelete?.();
        }}
        accessibilityState={
          selected === undefined ? { disabled: disabled || dimmed } : { selected, disabled: disabled || dimmed }
        }
        accessibilityHint={selected === undefined || dimmed ? undefined : t('foodSearch.select.rowHint')}
        disabled={disabled || dimmed}
        onPress={onPress}
        testID={`food-result-${food.id}`}
        style={({ pressed }) => ({
          minHeight: 60,
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing[3],
          paddingHorizontal: theme.spacing[4],
          paddingVertical: theme.spacing[2],
          backgroundColor: pressed || selected ? theme.colors.primaryTint : theme.colors.surface,
        })}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <AppText numberOfLines={1} color={dimmed ? 'textSecondary' : 'textPrimary'}>
            {food.name}
          </AppText>
          <AppText variant="compact" color={dimmed ? 'textTertiary' : 'textSecondary'} numberOfLines={1}>
            {basis} · {sourceLabel}
          </AppText>
        </View>
        <View style={{ width: 64, flexShrink: 0, alignItems: 'flex-end', marginLeft: theme.spacing[2] }}>
          <AppText variant="compact" numberOfLines={1} tabular align="right">
            {energyValue}
          </AppText>
          <AppText variant="compact" numberOfLines={1} align="right">
            {energyUnitLabel}
          </AppText>
        </View>
        {selected ? <AppIcon name="checkmark" color="primary" testID={`food-selected-${food.id}`} /> : null}
      </FocusablePressable>
    </SwipeToDelete>
  );
}
