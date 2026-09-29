import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, StyleSheet, View } from 'react-native';

import type { DiaryDay as DiaryDayModel, DiaryMeal } from '@/data/db/repositories/diaryRepository';
import type { EnergyUnit } from '@/domain/units/units';
import {
  AppIcon,
  AppText,
  BottomSheet,
  FocusablePressable,
  InlineStatus,
  PrimaryButton,
  TextAction,
  UndoToast,
} from '@/shared/components';
import { addDays, type LocalDate } from '@/shared/dates';
import { routes } from '@/shared/navigation/routes';
import { useTheme } from '@/shared/theme';

import { useAppSettings, useDiaryDay, useDiaryWrites } from '../diary.queries';
import { useDiaryDate } from '../hooks/DiaryDateContext';
import { CalorieRing } from './CalorieRing';
import { CopyFlow, type CopyTarget } from './CopyFlow';
import { useDiaryDateLabel } from './DiaryDateStrip';
import { MealEntries } from './DiaryEntryRow';
import { MacroStrip } from './MacroStrip';
import { MealHeader } from './MealHeader';

export type DiaryDayProps = {
  date: LocalDate;
  /** The selected page. Inactive (pre-rendered) pages jump back to the top, so a new day opens there (UX-02). */
  active: boolean;
  /** Bumped when the Diary tab is tapped at the root; the active page scrolls to the top (NAV-02). */
  scrollToTop?: number;
};

/** One diary day: overview (ring + macros), the default-goals row, and every meal in saved order (UX-02). */
export function DiaryDay({ date, active, scrollToTop = 0 }: DiaryDayProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const day = useDiaryDay(date);
  const settings = useAppSettings();
  const { deleteEntry, restoreEntry } = useDiaryWrites();
  const list = useRef<FlatList<DiaryMeal>>(null);
  // DS-10: one transient toast — Undo after a committed delete swipe, or a copy result / failure.
  const [toast, setToast] = useState<Toast | null>(null);
  const toastSeq = useRef(0);
  const showToast = (message: string, undo?: DiaryMeal['entries'][number]) => {
    toastSeq.current += 1;
    setToast({ key: toastSeq.current, message, undo });
  };

  // UX-02 / DATA-12: a committed swipe deletes immediately; resolving `false` springs the row back.
  const removeEntry = async (entry: DiaryMeal['entries'][number]): Promise<boolean> => {
    try {
      await deleteEntry.mutateAsync(entry.id);
      showToast(t('diary.entry.deleted', { name: entry.note ?? entry.name }), entry);
      return true;
    } catch {
      showToast(t('diary.entry.deleteError'));
      return false;
    }
  };
  const undoDelete = (entry: DiaryMeal['entries'][number]) => {
    setToast(null);
    restoreEntry.mutate(entry, { onError: () => showToast(t('diary.entry.deleteError')) });
  };

  useEffect(() => {
    if (!active) list.current?.scrollToOffset({ offset: 0, animated: false });
  }, [active]);

  useEffect(() => {
    if (active && scrollToTop > 0) list.current?.scrollToOffset({ offset: 0, animated: true });
    // Only a new tap scrolls; becoming active is handled above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollToTop]);

  if (day.isError || settings.isError) {
    // UX-02: a DB load failure is full-screen with Retry (never an offline banner).
    return (
      <View style={[styles.center, { padding: theme.spacing[4], gap: theme.spacing[4] }]} testID="diary-load-error">
        <AppText variant="sectionTitle" align="center">
          {t('diary.loadError.title')}
        </AppText>
        <PrimaryButton
          label={t('diary.loadError.retry')}
          onPress={() => {
            void day.refetch();
            void settings.refetch();
          }}
        />
      </View>
    );
  }
  // UX-00: local screens render directly; SQLite answers well under the 300 ms skeleton threshold.
  if (!day.data || !settings.data) return null;

  const unit = settings.data.energyUnit;
  const provisional = settings.data.goalsConfirmedAt === null;
  return (
    <View style={{ flex: 1 }}>
      <FlatList
        ref={list}
        testID={active ? 'diary-day-list' : undefined}
        data={day.data.meals}
        keyExtractor={(meal) => meal.meal.id}
        ListHeaderComponent={<Overview day={day.data} unit={unit} provisional={provisional} />}
        renderItem={({ item }) => (
          <MealSection meal={item} unit={unit} date={date} onDelete={removeEntry} onMessage={showToast} />
        )}
        contentContainerStyle={{ paddingBottom: theme.spacing[6], backgroundColor: theme.colors.surface }}
        style={{ backgroundColor: theme.colors.canvas }}
        keyboardDismissMode="on-drag"
      />
      {toast ? (
        <UndoToast
          key={toast.key}
          message={toast.message}
          undoLabel={toast.undo ? t('common.undo') : undefined}
          onUndo={toast.undo ? () => undoDelete(toast.undo!) : undefined}
          onDismiss={() => setToast((current) => (current?.key === toast.key ? null : current))}
          testID={toast.undo ? 'diary-delete-undo' : 'diary-toast'}
        />
      ) : null}
    </View>
  );
}

type Toast = { key: number; message: string; undo?: DiaryMeal['entries'][number] };

function Overview({ day, unit, provisional }: { day: DiaryDayModel; unit: EnergyUnit; provisional: boolean }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { today, setDate } = useDiaryDate();
  const dateLabel = useDiaryDateLabel();
  const goal = day.goal;
  const previous = addDays(day.date, -1);
  const next = addDays(day.date, 1);
  return (
    <View style={{ backgroundColor: theme.colors.surface }}>
      <View
        style={[
          styles.overview,
          { paddingHorizontal: theme.spacing[4], paddingTop: theme.spacing[3], paddingBottom: theme.spacing[3] },
          { gap: theme.spacing[3] },
        ]}
      >
        <View style={styles.ringNavigation}>
          <View style={styles.chevronSlot}>
            <DayChevron
              direction="previous"
              label={t('diary.overviewPreviousDay', { label: dateLabel(previous, today) })}
              onPress={() => setDate(previous)}
            />
          </View>
          <CalorieRing eatenKcal={day.totals.energyKcal} goalKcal={goal?.calorieTargetKcal ?? null} unit={unit} />
          <View style={styles.chevronSlot}>
            <DayChevron
              direction="next"
              label={t('diary.overviewNextDay', { label: dateLabel(next, today) })}
              onPress={() => setDate(next)}
            />
          </View>
        </View>
        <MacroStrip
          totals={day.totals}
          targets={
            goal
              ? { carbohydrateG: goal.carbohydrateTargetG, proteinG: goal.proteinTargetG, fatG: goal.fatTargetG }
              : null
          }
        />
      </View>
      {provisional ? (
        // UX-01: shown while goals are provisional; no dismiss. `Set goals` → Calories & Macros (UX-16).
        <View style={{ paddingHorizontal: theme.spacing[4], paddingBottom: theme.spacing[3] }}>
          <InlineStatus
            tone="info"
            message={t('diary.defaultGoals.message')}
            action={{
              label: t('diary.defaultGoals.action'),
              onPress: () => router.push(routes.caloriesMacros(), { withAnchor: true }),
            }}
            testID="diary-default-goals"
          />
        </View>
      ) : null}
    </View>
  );
}

function DayChevron({
  direction,
  label,
  onPress,
}: {
  direction: 'previous' | 'next';
  label: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <FocusablePressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      testID={`diary-overview-${direction}`}
      style={({ pressed }) => [
        styles.dayChevron,
        {
          width: 52,
          height: 52,
          borderRadius: theme.radii.pill,
          borderColor: theme.colors.divider,
          backgroundColor: pressed ? theme.colors.primaryTint : theme.colors.surfaceSubtle,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <AppIcon
        name={direction === 'previous' ? 'chevron-back' : 'chevron-forward'}
        size="centerAction"
        color="primary"
      />
    </FocusablePressable>
  );
}

function MealSection({
  meal,
  unit,
  date,
  onDelete,
  onMessage,
}: {
  meal: DiaryMeal;
  unit: EnergyUnit;
  date: LocalDate;
  onDelete: (entry: DiaryMeal['entries'][number]) => Promise<boolean>;
  onMessage: (message: string) => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { today } = useDiaryDate();
  const [menuTarget, setMenuTarget] = useState<CopyTarget | null>(null);
  const [queuedCopy, setQueuedCopy] = useState<CopyTarget | null>(null);
  const [copyTarget, setCopyTarget] = useState<CopyTarget | null>(null);
  const [copyVisible, setCopyVisible] = useState(false);

  const openEntryMenu = (entry: DiaryMeal['entries'][number]) =>
    setMenuTarget({ kind: 'entry', id: entry.id, name: entry.note ?? entry.name, sourceDate: date });
  return (
    <View testID={`diary-meal-${meal.meal.id}`}>
      <MealHeader
        name={meal.meal.name}
        energyKcal={meal.totals.energyKcal}
        unit={unit}
        onAdd={() => router.push(routes.foodSearch({ mealId: meal.meal.id, date }))}
        onMenu={() => setMenuTarget({ kind: 'meal', id: meal.meal.id, name: meal.meal.name, sourceDate: date })}
      />
      {/* UX-02: row tap → the matching edit screen; it returns here (NAV-04). */}
      <MealEntries entries={meal.entries} unit={unit} origin="diary" onDelete={onDelete} onMenu={openEntryMenu} />
      {/* DS-08 Add Food row (42–44): the last row per meal. */}
      <View
        style={{
          minHeight: theme.sizes.addFoodRow[1],
          paddingHorizontal: theme.spacing[2],
          justifyContent: 'center',
        }}
      >
        <TextAction
          icon="add"
          label={t('diary.meal.addFood')}
          accessibilityHint={t('diary.meal.addFoodTo', { meal: meal.meal.name })}
          onPress={() => router.push(routes.foodSearch({ mealId: meal.meal.id, date }))}
        />
      </View>
      <DashboardActionMenu
        target={menuTarget}
        visible={menuTarget !== null}
        copyDisabled={menuTarget?.kind === 'meal' && meal.entries.length === 0}
        onClose={() => setMenuTarget(null)}
        onCopy={() => {
          setQueuedCopy(menuTarget);
          setMenuTarget(null);
        }}
        onDismissed={() => {
          if (!queuedCopy) return;
          setCopyTarget(queuedCopy);
          setQueuedCopy(null);
          setCopyVisible(true);
        }}
      />
      {copyTarget ? (
        <CopyFlow
          visible={copyVisible}
          target={copyTarget}
          today={today}
          onClose={() => setCopyVisible(false)}
          onCopied={(message) => {
            setCopyTarget(null);
            onMessage(message);
          }}
          onError={(message) => {
            setCopyTarget(null);
            onMessage(message);
          }}
        />
      ) : null}
    </View>
  );
}

function DashboardActionMenu({
  target,
  visible,
  copyDisabled,
  onClose,
  onCopy,
  onDismissed,
}: {
  target: CopyTarget | null;
  visible: boolean;
  copyDisabled: boolean;
  onClose: () => void;
  onCopy: () => void;
  onDismissed: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const labelKey = target?.kind === 'meal' ? 'diary.actions.copyMeal' : 'diary.actions.copyItem';
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      onDismissed={onDismissed}
      accessibilityLabel={t('diary.actions.title', { name: target?.name ?? '' })}
      closeLabel={t('common.close')}
      testID="diary-actions-sheet"
    >
      <AppText
        variant="bodyStrong"
        accessibilityRole="header"
        numberOfLines={2}
        style={{ paddingHorizontal: theme.spacing[4], paddingBottom: theme.spacing[1] }}
      >
        {target?.name}
      </AppText>
      <FocusablePressable
        accessibilityRole="button"
        accessibilityLabel={t(labelKey)}
        accessibilityState={{ disabled: copyDisabled }}
        disabled={copyDisabled}
        onPress={onCopy}
        testID="diary-action-copy"
        style={({ pressed }) => ({
          minHeight: theme.sizes.settingsRow[0],
          justifyContent: 'center',
          paddingHorizontal: theme.spacing[4],
          backgroundColor: pressed ? theme.colors.primaryTint : theme.colors.surface,
          opacity: copyDisabled ? 0.5 : 1,
        })}
      >
        <AppText>{t(labelKey)}</AppText>
      </FocusablePressable>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  overview: { alignItems: 'center' },
  ringNavigation: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  chevronSlot: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  dayChevron: { alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
});
