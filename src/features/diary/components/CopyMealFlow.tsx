import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';

import { AppText, BottomSheet, FocusablePressable } from '@/shared/components';
import { addDays, type LocalDate } from '@/shared/dates';
import { formatShortDate } from '@/shared/i18n/format';
import { useFormattingLocale } from '@/shared/i18n/useFormattingLocale';
import { DatePicker } from '@/shared/navigation/DatePicker';
import { useTheme } from '@/shared/theme';

import { useDiaryWrites } from '../diary.queries';

type Choice = { kind: 'copy'; to: LocalDate } | { kind: 'pick' };

type Props = {
  visible: boolean;
  mealId: string;
  mealName: string;
  /** The source date (Meal Detail's date). */
  date: LocalDate;
  today: LocalDate;
  onClose: () => void;
  /** Copy committed: the caller stays on the source Meal Detail and shows this confirmation (UX-12, DS-10). */
  onCopied: (message: string) => void;
  onError: (message: string) => void;
};

/**
 * Copy Meal flow (UX-12, NAV-07): the sheet offers absolute Today / Tomorrow (even when the source is one of them)
 * and `Choose date…` → Date Picker in destination mode (UX-13, title only). The copy goes into the same `mealId` on
 * the destination date (DATA-16); the source date is allowed (appends duplicates). The sheet closes fully before the
 * picker opens (NAV-03 pattern).
 */
export function CopyMealFlow({ visible, mealId, mealName, date, today, onClose, onCopied, onError }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const locale = useFormattingLocale();
  const { copyMeal } = useDiaryWrites();
  const [picking, setPicking] = useState(false);
  // What to do once the sheet has finished closing.
  const [next, setNext] = useState<Choice | null>(null);
  const tomorrow = addDays(today, 1);

  const copyTo = (destinationDate: LocalDate) => {
    if (copyMeal.isPending) return;
    copyMeal.mutate(
      { mealId, sourceDate: date, destinationDate },
      {
        onSuccess: ({ copiedCount }) =>
          onCopied(
            t('copyMeal.copied', {
              count: copiedCount,
              meal: mealName,
              date: formatShortDate(destinationDate, today, locale),
            }),
          ),
        onError: () => onError(t('copyMeal.error')),
      },
    );
  };

  const choose = (choice: Choice) => {
    setNext(choice);
    onClose();
  };

  const rows: { key: string; label: string; onPress: () => void }[] = [
    {
      key: 'today',
      label: t('copyMeal.today', { date: formatShortDate(today, today, locale) }),
      onPress: () => choose({ kind: 'copy', to: today }),
    },
    {
      key: 'tomorrow',
      label: t('copyMeal.tomorrow', { date: formatShortDate(tomorrow, today, locale) }),
      onPress: () => choose({ kind: 'copy', to: tomorrow }),
    },
    {
      key: 'choose',
      label: t('copyMeal.chooseDate'),
      onPress: () => choose({ kind: 'pick' }),
    },
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
          setNext(null);
          if (next?.kind === 'copy') copyTo(next.to);
          else if (next?.kind === 'pick') setPicking(true);
        }}
        accessibilityLabel={t('copyMeal.title', { meal: mealName })}
        closeLabel={t('common.close')}
        testID="copy-meal-sheet"
      >
        <AppText
          variant="bodyStrong"
          accessibilityRole="header"
          style={{ paddingHorizontal: theme.spacing[4], paddingBottom: theme.spacing[1] }}
        >
          {t('copyMeal.title', { meal: mealName })}
        </AppText>
        {rows.map((row) => (
          <FocusablePressable
            key={row.key}
            onPress={row.onPress}
            accessibilityRole="button"
            accessibilityLabel={row.label}
            testID={`copy-meal-${row.key}`}
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
        visible={picking}
        value={date}
        today={today}
        title={t('copyMeal.dateTitle')}
        onConfirm={(picked) => {
          setPicking(false);
          copyTo(picked);
        }}
        onCancel={() => setPicking(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  label: { flex: 1 },
});
