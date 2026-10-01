import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import type { Food } from '@/data/db/repositories/foodsRepository';
import { AppText, SwipeToDelete } from '@/shared/components';
import { FocusablePressable } from '@/shared/components/FocusablePressable';
import { formatEnergy } from '@/shared/i18n/format';
import { useTheme } from '@/shared/theme';

/** DS-09 food result row (UX-04, UX-25): name, brand or basis, source, kcal; optional swipe-revealed Delete. */
export function FoodResultRow({
  food,
  locale,
  energyUnit,
  onPress,
  onDelete,
  disabled = false,
}: {
  food: Food;
  locale: string;
  energyUnit: 'kcal' | 'kJ';
  onPress: () => void;
  /** Revealed Delete button tap. Resolving `false` (the delete failed) closes the row again. */
  onDelete?: () => Promise<boolean>;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const basis = food.brand || t('foodSearch.perBasis', { quantity: food.basisQuantity, unit: food.basisUnit });
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
        disabled={disabled}
        onPress={onPress}
        testID={`food-result-${food.id}`}
        style={({ pressed }) => ({
          minHeight: 60,
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing[3],
          paddingHorizontal: theme.spacing[4],
          paddingVertical: theme.spacing[2],
          backgroundColor: pressed ? theme.colors.primaryTint : theme.colors.surface,
        })}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <AppText numberOfLines={1}>{food.name}</AppText>
          <AppText variant="compact" color="textSecondary" numberOfLines={1}>
            {basis} · {t(`foodSearch.sources.${food.source}`)}
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
      </FocusablePressable>
    </SwipeToDelete>
  );
}
