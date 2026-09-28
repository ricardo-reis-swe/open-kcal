import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import type { UnitPreferences } from '@/domain/units/units';
import { useAppSettings } from '@/features/diary/diary.queries';
import { AppBar, AppText, InlineStatus, TextAction } from '@/shared/components';
import { useTheme } from '@/shared/theme';

import { useUpdateUnits } from '../profile.queries';

type Props = { onBack: () => void };

type Group<K extends keyof UnitPreferences = keyof UnitPreferences> = {
  key: K;
  label: 'units.weight' | 'units.foodWeight' | 'units.energy' | 'units.volume';
  options: readonly UnitPreferences[K][];
};

const GROUPS: readonly Group[] = [
  { key: 'weightUnit', label: 'units.weight', options: ['kg', 'lb'] },
  { key: 'foodWeightUnit', label: 'units.foodWeight', options: ['g', 'oz'] },
  { key: 'energyUnit', label: 'units.energy', options: ['kcal', 'kJ'] },
  { key: 'volumeUnit', label: 'units.volume', options: ['ml', 'fl_oz'] },
];

/**
 * UX-18 / NAV-06 Units: 4 segmented controls; each change saves immediately (no Save button). The selection shows
 * the stored value from the one settings query, which every screen reads, so the change applies everywhere.
 */
export function UnitsScreen({ onBack }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const settings = useAppSettings().data;
  const update = useUpdateUnits();
  const [saveFailed, setSaveFailed] = useState(false);

  const choose = async (change: Partial<UnitPreferences>) => {
    setSaveFailed(false);
    try {
      await update.mutateAsync(change);
    } catch {
      setSaveFailed(true);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.canvas }}>
      <AppBar title={t('units.title')} back={{ label: t('common.back'), onPress: onBack }} />
      {settings ? (
        <ScrollView contentContainerStyle={{ padding: theme.spacing[4], gap: theme.spacing[6] }}>
          {GROUPS.map(({ key, label, options }) => (
            <View
              key={key}
              style={{ gap: theme.spacing[1] }}
              accessibilityRole="radiogroup"
              accessibilityLabel={t(label)}
            >
              <AppText variant="label" color="textSecondary" accessible={false} importantForAccessibility="no">
                {t(label)}
              </AppText>
              <View style={[styles.segments, { gap: theme.spacing[4] }]}>
                {options.map((unit) => (
                  <TextAction
                    key={unit}
                    label={t(`units.${unit}`)}
                    selected={settings[key] === unit}
                    onPress={() => {
                      if (settings[key] !== unit) void choose({ [key]: unit });
                    }}
                    testID={`units-${key}-${unit}`}
                  />
                ))}
              </View>
            </View>
          ))}
          {saveFailed ? <InlineStatus tone="error" message={t('units.saveError')} testID="units-error" /> : null}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  segments: { flexDirection: 'row' },
});
