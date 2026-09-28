import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';

import { AppText, BottomSheet, FocusablePressable } from '@/shared/components';
import { addDays, type LocalDate } from '@/shared/dates';
import { formatShortDate } from '@/shared/i18n/format';
import { DatePicker } from '@/shared/navigation/DatePicker';
import { MealPicker } from '@/shared/navigation/MealPicker';
import { useFormattingLocale } from '@/shared/i18n/useFormattingLocale';
import { useTheme } from '@/shared/theme';

import { useDiaryWrites, useMeals } from '../diary.queries';

type Choice = { kind: 'date'; date: LocalDate } | { kind: 'picker' };
export type CopyTarget =
  | { kind: 'meal'; id: string; name: string; sourceDate: LocalDate }
  | { kind: 'entry'; id: string; name: string; sourceDate: LocalDate };

type Props = {
  visible: boolean;
  target: CopyTarget;
  today: LocalDate;
  onClose: () => void;
  onCopied: (message: string) => void;
  onError: (message: string) => void;
};

/** Dashboard copy flow: destination date first, then an explicit destination meal for both entries and meals. */
export function CopyFlow({ visible, target, today, onClose, onCopied, onError }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const locale = useFormattingLocale();
  const meals = useMeals();
  const { copyMeal, copyEntry } = useDiaryWrites();
  const [next, setNext] = useState<Choice | null>(null);
  const [pickingDate, setPickingDate] = useState(false);
  const [pickingMeal, setPickingMeal] = useState(false);
  const [destinationDate, setDestinationDate] = useState<LocalDate>(target.sourceDate);
  const tomorrow = addDays(today, 1);

  const choose = (choice: Choice) => {
    setNext(choice);
    onClose();
  };
  const continueWithDate = (date: LocalDate) => {
    setDestinationDate(date);
    setPickingMeal(true);
  };
  const copyToMeal = (destinationMealId: string) => {
    setPickingMeal(false);
    const destinationMeal = meals.data?.find((meal) => meal.id === destinationMealId);
    if (!destinationMeal) return;
    const copied = (count: number) =>
      onCopied(
        t('copyFlow.copied', {
          count,
          meal: destinationMeal.name,
          date: formatShortDate(destinationDate, today, locale),
        }),
      );
    if (target.kind === 'meal') {
      copyMeal.mutate(
        {
          mealId: target.id,
          sourceDate: target.sourceDate,
          destinationDate,
          destinationMealId,
        },
        { onSuccess: (result) => copied(result.copiedCount), onError: () => onError(t('copyFlow.error')) },
      );
    } else {
      copyEntry.mutate(
        { entryId: target.id, destinationDate, destinationMealId },
        { onSuccess: () => copied(1), onError: () => onError(t('copyFlow.error')) },
      );
    }
  };

  const rows = [
    {
      key: 'today',
      label: t('copyFlow.today', { date: formatShortDate(today, today, locale) }),
      onPress: () => choose({ kind: 'date' as const, date: today }),
    },
    {
      key: 'tomorrow',
      label: t('copyFlow.tomorrow', { date: formatShortDate(tomorrow, today, locale) }),
      onPress: () => choose({ kind: 'date' as const, date: tomorrow }),
    },
    { key: 'choose', label: t('copyFlow.chooseDate'), onPress: () => choose({ kind: 'picker' as const }) },
  ];

  return (
    <>
      <BottomSheet
        visible={visible}
        onClose={() => {
          setNext(null);
          onClose();
        }}
        onDismissed={() => {
          const choice = next;
          setNext(null);
          if (choice?.kind === 'date') continueWithDate(choice.date);
          else if (choice?.kind === 'picker') setPickingDate(true);
        }}
        accessibilityLabel={t(target.kind === 'meal' ? 'copyFlow.mealTitle' : 'copyFlow.itemTitle', {
          name: target.name,
        })}
        closeLabel={t('common.close')}
        testID="copy-date-sheet"
      >
        <AppText
          variant="bodyStrong"
          accessibilityRole="header"
          style={{ paddingHorizontal: theme.spacing[4], paddingBottom: theme.spacing[1] }}
        >
          {t(target.kind === 'meal' ? 'copyFlow.mealTitle' : 'copyFlow.itemTitle', { name: target.name })}
        </AppText>
        {rows.map((row) => (
          <FocusablePressable
            key={row.key}
            onPress={row.onPress}
            accessibilityRole="button"
            accessibilityLabel={row.label}
            testID={`copy-${row.key}`}
            style={({ pressed }) => [
              styles.row,
              {
                minHeight: theme.sizes.settingsRow[0],
                paddingHorizontal: theme.spacing[4],
                backgroundColor: pressed ? theme.colors.primaryTint : theme.colors.surface,
              },
            ]}
          >
            <AppText variant="body" numberOfLines={2} style={styles.label}>
              {row.label}
            </AppText>
          </FocusablePressable>
        ))}
      </BottomSheet>
      <DatePicker
        visible={pickingDate}
        value={target.sourceDate}
        today={today}
        title={t('copyFlow.dateTitle')}
        onConfirm={(date) => {
          setPickingDate(false);
          continueWithDate(date);
        }}
        onCancel={() => setPickingDate(false)}
      />
      <MealPicker
        visible={pickingMeal}
        meals={meals.data ?? []}
        onSelect={copyToMeal}
        onClose={() => setPickingMeal(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  label: { flex: 1 },
});
