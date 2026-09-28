import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Keyboard, View } from 'react-native';

import type { WeightUnit } from '@/domain/units/units';
import { parseWeightInput, weightInputRange, weightInputText, type WeightEntry } from '@/domain/weight/weight';
import { useAppSettings } from '@/features/diary/diary.queries';
import {
  AppText,
  BottomSheet,
  ConfirmationDialog,
  FormField,
  HeaderAction,
  InlineStatus,
  ListRow,
  TextAction,
} from '@/shared/components';
import type { LocalDate } from '@/shared/dates';
import { formatShortDate, formatWeight, relativeDay } from '@/shared/i18n/format';
import { useFormattingLocale } from '@/shared/i18n/useFormattingLocale';
import { DatePicker } from '@/shared/navigation/DatePicker';
import { useTheme } from '@/shared/theme';

import { useCurrentWeight, useWeightEntry, useWeightWrites } from '../profile.queries';

export type WeightEntryTarget = { mode: 'create' } | { mode: 'edit'; weightEntryId: string };

type Props = {
  visible: boolean;
  target: WeightEntryTarget;
  today: LocalDate;
  onClose: () => void;
};

/**
 * UX-14 / NAV-07 Weight Entry Sheet: date (≤ today) + weight in `weight_unit`, Save, Delete (edit only).
 * Create defaults to today with the current weight as placeholder; edit loads the record. Save → close; the weight
 * queries refresh so Profile and Weight History update (DATA-13: canonical kg, `measured_at` derived by the repo).
 */
export function WeightEntrySheet({ visible, target, today, onClose }: Props) {
  const { t } = useTranslation();
  const title = t(target.mode === 'edit' ? 'weightEntry.editTitle' : 'weightEntry.createTitle');
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      accessibilityLabel={title}
      closeLabel={t('common.close')}
      avoidKeyboard
      testID="weight-entry-sheet"
    >
      <SheetContent target={target} title={title} today={today} onDone={onClose} />
    </BottomSheet>
  );
}

function SheetContent({
  target,
  title,
  today,
  onDone,
}: {
  target: WeightEntryTarget;
  title: string;
  today: LocalDate;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const settings = useAppSettings().data;
  const current = useCurrentWeight();
  const editId = target.mode === 'edit' ? target.weightEntryId : '';
  const entryQuery = useWeightEntry(editId, target.mode === 'edit');
  // Keep the loaded record: after a delete the entry query is gone, and the closing sheet must not flash "not found".
  const [entry, setEntry] = useState<WeightEntry | null>(null);
  if (entryQuery.data && !entry) setEntry(entryQuery.data);

  const heading = (
    <AppText
      variant="bodyStrong"
      accessibilityRole="header"
      style={{ paddingHorizontal: theme.spacing[4], paddingBottom: theme.spacing[1] }}
    >
      {title}
    </AppText>
  );

  if (target.mode === 'edit' && !entry && entryQuery.isError) {
    return (
      <View style={{ paddingBottom: theme.spacing[4] }}>
        {heading}
        <AppText variant="body" color="textSecondary" style={{ paddingHorizontal: theme.spacing[4] }}>
          {t('common.notFound')}
        </AppText>
      </View>
    );
  }
  if (!settings || !current.isSuccess || (target.mode === 'edit' && !entry)) return heading;
  return (
    <WeightForm
      title={title}
      entry={entry}
      placeholderKg={current.data?.weightKg ?? null}
      unit={settings.weightUnit}
      today={today}
      onDone={onDone}
    />
  );
}

function WeightForm({
  title,
  entry,
  placeholderKg,
  unit,
  today,
  onDone,
}: {
  title: string;
  entry: WeightEntry | null;
  placeholderKg: number | null;
  unit: WeightUnit;
  today: LocalDate;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const locale = useFormattingLocale();
  const { add, update, remove } = useWeightWrites();
  const [initialDate] = useState(entry?.localDate ?? today);
  const [initialText] = useState(() => (entry ? weightInputText(entry.weightKg, unit, locale) : ''));
  const [date, setDate] = useState(initialDate);
  const [value, setValue] = useState(initialText);
  const [touched, setTouched] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [status, setStatus] = useState<'saveError' | 'deleteError' | null>(null);
  const [picking, setPicking] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // An unchanged field keeps the stored (unrounded) kg; otherwise DATA-13: display unit → kg, validated (UX-00).
  const kg = entry && value === initialText ? entry.weightKg : parseWeightInput(value, unit, locale);
  const dirty = value !== initialText || date !== initialDate;
  const pending = add.isPending || update.isPending || remove.isPending;
  // UX-00: disabled until valid; in edit mode also until something changed.
  const canSave = kg !== null && (entry === null || dirty) && !pending;

  const unitLabel = t(`units.${unit}`);
  const weightText = (w: number) => `${formatWeight(w, unit, locale)} ${unitLabel}`;
  const range = weightInputRange(unit);
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const error =
    kg === null && (touched || submitted)
      ? t('weightEntry.error', { min: number.format(range.min), max: number.format(range.max), unit: unitLabel })
      : undefined;

  const shortDate = formatShortDate(date, today, locale);
  const relative = relativeDay(date, today);
  const dateLabel =
    relative === 'today'
      ? t('weightEntry.today', { date: shortDate })
      : relative === 'yesterday'
        ? t('weightEntry.yesterday', { date: shortDate })
        : shortDate;

  const submit = async () => {
    setSubmitted(true);
    if (!canSave || kg === null) return;
    setStatus(null);
    try {
      if (entry) await update.mutateAsync({ id: entry.id, localDate: date, weightKg: kg });
      else await add.mutateAsync({ localDate: date, weightKg: kg });
      onDone();
    } catch {
      setStatus('saveError'); // UX-00: stay, keep the input.
    }
  };

  const confirmDelete = async () => {
    if (!entry) return;
    setConfirmingDelete(false);
    setStatus(null);
    try {
      await remove.mutateAsync(entry.id);
      onDone();
    } catch {
      setStatus('deleteError');
    }
  };

  return (
    <View style={{ gap: theme.spacing[3], paddingBottom: theme.spacing[2] }}>
      <View
        style={{
          minHeight: theme.touchMin,
          paddingLeft: theme.spacing[4],
          paddingRight: theme.spacing[1],
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        <AppText variant="bodyStrong" accessibilityRole="header" numberOfLines={1} style={{ flex: 1 }}>
          {title}
        </AppText>
        <HeaderAction
          label={t('weightEntry.save')}
          onPress={() => void submit()}
          disabled={!canSave}
          loading={add.isPending || update.isPending}
          placement="surface"
          testID="weight-entry-save"
        />
      </View>
      <ListRow
        label={t('weightEntry.date')}
        value={dateLabel}
        onPress={() => {
          Keyboard.dismiss();
          setPicking(true);
        }}
        testID="weight-entry-date"
      />
      <View style={{ paddingHorizontal: theme.spacing[4] }}>
        <FormField
          label={t('weightEntry.field')}
          value={value}
          onChangeText={setValue}
          onBlur={() => setTouched(true)}
          placeholder={placeholderKg === null || entry ? undefined : weightInputText(placeholderKg, unit, locale)}
          keyboardType="decimal-pad"
          returnKeyType="done"
          onSubmitEditing={() => void submit()}
          autoFocus
          unit={unitLabel}
          error={error}
          testID="weight-entry-input"
        />
      </View>
      <View style={{ paddingHorizontal: theme.spacing[4], gap: theme.spacing[2] }}>
        {status ? <InlineStatus tone="error" message={t(`weightEntry.${status}`)} /> : null}
      </View>
      {entry ? (
        <View style={{ alignItems: 'center' }}>
          <TextAction
            label={t('weightEntry.delete')}
            tone="danger"
            onPress={() => {
              Keyboard.dismiss();
              setConfirmingDelete(true);
            }}
            disabled={pending}
            testID="weight-entry-delete"
          />
        </View>
      ) : null}
      {/* Rendered inside the sheet so they present over it (a sibling modal can't open over an open one on iOS). */}
      <DatePicker
        visible={picking}
        value={date}
        today={today}
        maximumDate={today}
        onConfirm={(picked) => {
          setPicking(false);
          setDate(picked > today ? today : picked); // DATA-13: local_date ≤ today
        }}
        onCancel={() => setPicking(false)}
      />
      {entry ? (
        <ConfirmationDialog
          visible={confirmingDelete}
          title={t('weightEntry.deleteTitle')}
          body={t('weightEntry.deleteBody', {
            weight: weightText(entry.weightKg),
            date: formatShortDate(entry.localDate, today, locale),
          })}
          confirmLabel={t('weightEntry.deleteConfirm')}
          cancelLabel={t('common.cancel')}
          destructive
          onConfirm={() => void confirmDelete()}
          onCancel={() => setConfirmingDelete(false)}
          testID="weight-entry-delete-dialog"
        />
      ) : null}
    </View>
  );
}
