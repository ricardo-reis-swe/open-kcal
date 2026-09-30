import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Switch, View } from 'react-native';

import {
  moveDashboardNutrient,
  setDashboardNutrientVisible,
  type DashboardNutrient,
} from '@/domain/nutrition/dashboardNutrients';
import { NUTRIENT_GROUPS, NUTRIENT_IDS, catalogNutrient, type NutrientId } from '@/domain/nutrition/nutrientCatalog';
import { useDashboardNutrients, useSetDashboardNutrients } from '@/features/diary/diary.queries';
import { AppBar, AppText, InlineStatus, SectionHeader } from '@/shared/components';
import { useTheme } from '@/shared/theme';

import { ReorderableSwitchRow, useReorderDragState } from '../components/ReorderableSwitchRow';

/**
 * UX-21 / NAV-06 Dashboard nutrients (DATA-21): `Shown` in dashboard order (switch + drag handle, a11y moves), then
 * the hidden nutrients by catalog group. Switching one on appends it to `Shown`. Every change saves immediately.
 */
export function DashboardNutrientsScreen({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const items = useDashboardNutrients().data;
  const save = useSetDashboardNutrients();
  const drag = useReorderDragState();
  const [saveFailed, setSaveFailed] = useState(false);

  const commit = (next: DashboardNutrient[] | null) => {
    if (!next || save.isPending) return;
    setSaveFailed(false);
    save.mutate(next, { onError: () => setSaveFailed(true) });
  };
  const name = (id: NutrientId) => t(`nutrients.names.${id}`);
  const shown = items?.filter((item) => item.visible) ?? [];
  const hidden = items?.filter((item) => !item.visible) ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.canvas }}>
      <AppBar title={t('dashboardNutrients.title')} back={{ label: t('common.back'), onPress: onBack }} />
      {items ? (
        <ScrollView contentContainerStyle={{ paddingBottom: theme.spacing[6] }} testID="dashboard-nutrients">
          {saveFailed ? <InlineStatus tone="error" message={t('dashboardNutrients.saveError')} /> : null}
          <SectionHeader label={t('dashboardNutrients.shown')} uppercase />
          {shown.length === 0 ? (
            <AppText variant="compact" color="textSecondary" style={{ paddingHorizontal: theme.spacing[4] }}>
              {t('dashboardNutrients.noneHelper')}
            </AppText>
          ) : (
            shown.map((item, index) => (
              <ReorderableSwitchRow
                key={item.id}
                label={name(item.id)}
                index={index}
                count={shown.length}
                drag={drag}
                value
                onToggle={(visible) => commit(setDashboardNutrientVisible(items, item.id, visible))}
                onMove={(delta) => commit(moveDashboardNutrient(items, item.id, index + delta))}
                onDrop={(to) => commit(moveDashboardNutrient(items, item.id, to))}
                testIDPrefix="dashboard-nutrient"
                rowKey={item.id}
              />
            ))
          )}
          {NUTRIENT_GROUPS.map((group) => {
            const rows = hidden
              .filter((item) => catalogNutrient(item.id).group === group)
              .sort((a, b) => catalogOrder(a.id) - catalogOrder(b.id));
            if (rows.length === 0) return null;
            return (
              <View key={group} testID={`dashboard-nutrients-group-${group}`}>
                <SectionHeader label={t(`nutrients.groups.${group}`)} uppercase />
                {rows.map((item) => (
                  <View
                    key={item.id}
                    style={[
                      styles.row,
                      {
                        minHeight: theme.sizes.settingsRow[0],
                        paddingLeft: theme.spacing[4],
                        paddingRight: theme.spacing[3],
                        backgroundColor: theme.colors.surface,
                        borderBottomWidth: StyleSheet.hairlineWidth,
                        borderBottomColor: theme.colors.divider,
                      },
                    ]}
                  >
                    <AppText variant="body" style={styles.label}>
                      {name(item.id)}
                    </AppText>
                    <Switch
                      value={false}
                      onValueChange={(visible) => commit(setDashboardNutrientVisible(items, item.id, visible))}
                      accessibilityLabel={name(item.id)}
                      trackColor={{ true: theme.colors.primary, false: theme.colors.divider }}
                      testID={`dashboard-nutrient-switch-${item.id}`}
                    />
                  </View>
                ))}
              </View>
            );
          })}
        </ScrollView>
      ) : null}
    </View>
  );
}

/** Hidden rows list in catalog order within their group (UX-21). */
const catalogOrder = (id: NutrientId) => NUTRIENT_IDS.indexOf(id);

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  label: { flex: 1 },
});
