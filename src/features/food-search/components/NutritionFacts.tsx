import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import {
  NUTRIENT_GROUPS,
  catalogNutrient,
  knownNutrients,
  type NutrientAmounts,
} from '@/domain/nutrition/nutrientCatalog';
import { AppText, SectionHeader } from '@/shared/components';
import { formatNutrientAmount } from '@/shared/i18n/format';
import { useTheme } from '@/shared/theme';

/**
 * UX-05 / DS-09 Nutrition facts: every catalog nutrient the food (or entry snapshot) knows, grouped in catalog order,
 * already scaled to the chosen serving. Unknown nutrients are left out (DATA-06).
 */
export function NutritionFacts({ amounts, locale }: { amounts: NutrientAmounts | undefined; locale: string }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const known = knownNutrients(amounts);
  return (
    <View testID="nutrition-facts">
      <SectionHeader label={t('nutrients.title')} uppercase />
      {known.length === 0 ? (
        <AppText color="textSecondary" style={{ paddingHorizontal: theme.spacing[4] }}>
          {t('nutrients.empty')}
        </AppText>
      ) : (
        NUTRIENT_GROUPS.map((group) => {
          const rows = known.filter(({ id }) => catalogNutrient(id).group === group);
          if (rows.length === 0) return null;
          return (
            <View key={group} testID={`nutrition-facts-${group}`} style={{ paddingBottom: theme.spacing[2] }}>
              <AppText
                variant="label"
                color="textSecondary"
                accessibilityRole="header"
                style={{ paddingHorizontal: theme.spacing[4], paddingVertical: theme.spacing[1] }}
              >
                {t(`nutrients.groups.${group}`)}
              </AppText>
              {rows.map(({ id, amount }) => {
                const { unit, decimals } = catalogNutrient(id);
                const value = formatNutrientAmount(amount, decimals, locale);
                const name = t(`nutrients.names.${id}`);
                return (
                  <View
                    key={id}
                    accessible
                    accessibilityLabel={t('nutrients.a11y', { name, value, unit: t(`nutrients.unitsSpoken.${unit}`) })}
                    testID={`nutrition-fact-${id}`}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: theme.spacing[3],
                      minHeight: 32,
                      paddingHorizontal: theme.spacing[4],
                    }}
                  >
                    <AppText variant="compact" numberOfLines={1} style={{ flex: 1 }}>
                      {name}
                    </AppText>
                    <AppText variant="compact" tabular align="right">
                      {`${value} ${unit}`}
                    </AppText>
                  </View>
                );
              })}
            </View>
          );
        })
      )}
    </View>
  );
}
