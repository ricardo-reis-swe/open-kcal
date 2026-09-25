import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppIcon, AppText, BottomSheet, FocusablePressable } from '@/shared/components';
import { useTheme } from '@/shared/theme';

export type MealOption = { id: string; name: string };

type Props = {
  visible: boolean;
  /** The user's meals in saved order (NAV-07). Never fixed names. */
  meals: readonly MealOption[];
  /** When changing an entry's meal, the current one gets a check (UX-10). */
  selectedId?: string | null;
  /** Tap = select + close (UX-10). The caller closes the sheet. */
  onSelect: (mealId: string) => void;
  onClose: () => void;
  onDismissed?: () => void;
};

/** Meal Picker (UX-10, NAV-07): compact `Choose meal` title and one 48 row per meal (DS-09). */
export function MealPicker({ visible, meals, selectedId = null, onSelect, onClose, onDismissed }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      onDismissed={onDismissed}
      accessibilityLabel={t('mealPicker.title')}
      closeLabel={t('common.close')}
      testID="meal-picker"
    >
      <AppText
        variant="bodyStrong"
        accessibilityRole="header"
        style={{ paddingHorizontal: theme.spacing[4], paddingBottom: theme.spacing[1] }}
      >
        {t('mealPicker.title')}
      </AppText>
      <ScrollView bounces={false}>
        {meals.map((meal) => {
          const selected = meal.id === selectedId;
          return (
            <FocusablePressable
              key={meal.id}
              onPress={() => onSelect(meal.id)}
              accessibilityRole="button"
              accessibilityLabel={meal.name}
              accessibilityState={{ selected }}
              testID={`meal-picker-${meal.id}`}
              style={({ pressed }) => [
                styles.row,
                {
                  minHeight: theme.sizes.settingsRow[0],
                  paddingHorizontal: theme.spacing[4],
                  gap: theme.spacing[3],
                  backgroundColor: pressed ? theme.colors.primaryTint : theme.colors.surface,
                },
              ]}
            >
              <AppText variant="body" numberOfLines={2} style={styles.label}>
                {meal.name}
              </AppText>
              {/* Fixed-width slot, so names align whether or not a row is checked. */}
              <View style={{ width: theme.spacing[6], alignItems: 'flex-end' }}>
                {selected ? <AppIcon name="checkmark" color="primary" /> : null}
              </View>
            </FocusablePressable>
          );
        })}
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  label: { flex: 1 },
});
