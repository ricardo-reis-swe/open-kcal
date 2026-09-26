import { router } from 'expo-router';
import { Controller, useForm, useWatch, type FieldErrors, type Resolver } from 'react-hook-form';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View, type TextInput } from 'react-native';

import type { DiaryEntry } from '@/data/db/repositories/diaryRepository';
import {
  QUICK_CALORIES_NOTE_MAX,
  parseQuickCaloriesInput,
  quickCaloriesFormSchema,
  quickCaloriesRange,
  type QuickCaloriesFormValues,
} from '@/domain/diary/entries';
import { energyFromKcal, type EnergyUnit } from '@/domain/units/units';
import {
  AppBar,
  ConfirmationDialog,
  FormField,
  InlineStatus,
  ListRow,
  NotFoundState,
  PrimaryButton,
  TextAction,
} from '@/shared/components';
import type { LocalDate } from '@/shared/dates';
import { NotFoundError } from '@/shared/errors';
import { formatEnergy, formatInteger, formatShortDate } from '@/shared/i18n/format';
import { useFormattingLocale } from '@/shared/i18n/useFormattingLocale';
import { MealPicker } from '@/shared/navigation/MealPicker';
import { routes, type Origin } from '@/shared/navigation/routes';
import { useTheme } from '@/shared/theme';

import { useAppSettings, useDiaryEntry, useDiaryWrites, useMeals } from '../diary.queries';
import { useDiaryDate } from '../hooks/DiaryDateContext';

export type QuickCaloriesMode =
  { kind: 'add'; mealId: string; date: LocalDate; origin: Origin } | { kind: 'edit'; entryId: string; origin: Origin };

/** Back to the stack root (UX-00 not found, NAV-03 global add). */
const toDiaryRoot = () => router.dismissTo(routes.diary());

/**
 * Quick Calories and Edit Quick Calories (UX-07, NAV-04). `mode` is `null` when the route params were invalid.
 * Add ends on the Diary on the target date (NAV-03); edit returns to its exact origin, except a meal change from
 * Meal Detail, which lands on the Diary (NAV-04). Delete is confirmed (NAV-08, UX-19).
 */
export function QuickCaloriesScreen({ mode }: { mode: QuickCaloriesMode | null }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const settings = useAppSettings();
  const meals = useMeals();
  const entry = useDiaryEntry(mode?.kind === 'edit' ? mode.entryId : '', mode?.kind === 'edit');
  const editing = mode?.kind === 'edit';
  const title = editing ? t('quickCalories.editTitle') : t('quickCalories.title');
  const goBack = () => {
    // NAV-09: a cancelled global flow returns to the tab where it began.
    if (mode?.kind === 'add' && mode.origin === 'profile') router.replace(routes.profile());
    else router.back();
  };

  let body: React.ReactNode = null;
  const notFound = <NotFoundState actionLabel={t('common.backToDiary')} onAction={toDiaryRoot} />;
  if (!mode) {
    body = notFound;
  } else if (editing && entry.error instanceof NotFoundError) {
    body = notFound;
  } else if (editing && entry.data && entry.data.kind !== 'quick_calories') {
    body = notFound;
  } else if (settings.data && meals.data && (!editing || entry.data)) {
    const initialMeal = mode.kind === 'edit' ? entry.data!.mealId : mode.mealId;
    if (!meals.data.some((m) => m.id === initialMeal)) {
      body = notFound;
    } else {
      body = (
        <QuickCaloriesForm
          // A different entry (or a refetch after save) must not reset what the user is typing.
          key={mode.kind === 'edit' ? mode.entryId : 'add'}
          mode={mode}
          entry={mode.kind === 'edit' ? entry.data! : null}
          unit={settings.data.energyUnit}
          meals={meals.data}
          initialMealId={initialMeal}
        />
      );
    }
  }
  // UX-00: local screens render directly (no skeleton under 300 ms); load errors other than not found are rare
  // enough to share the not-found recovery path.
  if (!body && (settings.isError || meals.isError || (editing && entry.isError))) body = notFound;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.canvas }}>
      <AppBar title={title} back={{ label: t('common.back'), onPress: goBack }} />
      {body}
    </View>
  );
}

type FormProps = {
  mode: QuickCaloriesMode;
  entry: DiaryEntry | null;
  unit: EnergyUnit;
  meals: readonly { id: string; name: string }[];
  initialMealId: string;
};

function QuickCaloriesForm({ mode, entry, unit, meals, initialMealId }: FormProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const locale = useFormattingLocale();
  const { today, setDate } = useDiaryDate();
  const writes = useDiaryWrites();
  const noteRef = useRef<TextInput>(null);

  const initialCalories = entry ? String(Math.round(energyFromKcal(entry.nutrients.energyKcal, unit))) : '';
  const initialNote = entry?.note ?? '';
  const date = mode.kind === 'add' ? mode.date : entry!.diaryDate;

  const schema = quickCaloriesFormSchema(unit);
  const resolver: Resolver<QuickCaloriesFormValues> = async (values) => {
    const result = schema.safeParse(values);
    if (result.success) return { values: result.data, errors: {} };
    const errors: FieldErrors<QuickCaloriesFormValues> = {};
    for (const issue of result.error.issues) {
      const field = issue.path[0];
      if (field === 'mealId' || field === 'calories' || field === 'note') {
        errors[field] ??= { type: 'validate', message: issue.message };
      }
    }
    return { values: {}, errors };
  };
  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors, isDirty, isSubmitting, isValid, submitCount, touchedFields },
  } = useForm<QuickCaloriesFormValues>({
    defaultValues: { mealId: initialMealId, calories: initialCalories, note: initialNote },
    mode: 'onChange',
    resolver,
  });
  const mealId = useWatch({ control, name: 'mealId' });
  const [failure, setFailure] = useState<'save' | 'delete' | null>(null);
  const [pickingMeal, setPickingMeal] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const unitLabel = t(`diary.units.${unit}`);
  const canSubmit = isValid && (mode.kind === 'add' || isDirty) && !isSubmitting && !busy;
  const range = quickCaloriesRange(unit);
  const caloriesError =
    errors.calories && (touchedFields.calories || submitCount > 0)
      ? t('quickCalories.caloriesError', {
          min: formatInteger(range.min, locale),
          max: formatInteger(range.max, locale),
          unit: unitLabel,
        })
      : undefined;
  const mealName = (id: string) => meals.find((m) => m.id === id)?.name ?? '';

  const submit = async (values: QuickCaloriesFormValues) => {
    const parsed = schema.safeParse(values);
    const kcal = parsed.success ? parseQuickCaloriesInput(parsed.data.calories, unit) : null;
    if (kcal === null) return;
    setFailure(null);
    try {
      if (mode.kind === 'add') {
        await writes.addQuickCalories.mutateAsync({
          diaryDate: mode.date,
          mealId: values.mealId,
          energyKcal: kcal,
          note: values.note,
        });
        // NAV-03: global Quick Calories ends on the Diary on the target date.
        setDate(mode.date);
        toDiaryRoot();
      } else {
        // An untouched Calories field keeps the stored (unrounded) kcal, so a kJ round trip never drifts.
        const energyKcal = values.calories.trim() === initialCalories ? entry!.nutrients.energyKcal : kcal;
        await writes.editQuickCalories.mutateAsync({
          id: entry!.id,
          mealId: values.mealId,
          energyKcal,
          note: values.note,
        });
        // NAV-04: exact origin, except a meal change from Meal Detail lands on the Diary.
        if (mode.origin === 'mealDetail' && values.mealId !== initialMealId) toDiaryRoot();
        else router.back();
      }
    } catch {
      // UX-00: stay, keep the input, inline error above the primary action.
      setFailure('save');
    }
  };

  const remove = async () => {
    setConfirmingDelete(false);
    setBusy(true);
    setFailure(null);
    try {
      await writes.deleteEntry.mutateAsync(entry!.id);
      router.back();
    } catch {
      setFailure('delete');
      setBusy(false);
    }
  };

  return (
    <>
      {/* DS-09: the keyboard never covers the primary action. Android is edge-to-edge, so the window doesn't resize
          and both platforms need padding. */}
      <KeyboardAvoidingView style={styles.fill} behavior="padding">
        <ScrollView
          style={styles.fill}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ paddingVertical: theme.spacing[4], gap: theme.spacing[4] }}
        >
          <ListRow
            label={t('quickCalories.meal')}
            value={mealName(mealId)}
            onPress={() => setPickingMeal(true)}
            navigates
            accessibilityHint={t('quickCalories.mealHint')}
            testID="quick-calories-meal"
          />
          <View style={{ paddingHorizontal: theme.spacing[4], gap: theme.spacing[4] }}>
            <Controller
              control={control}
              name="calories"
              render={({ field }) => (
                <FormField
                  label={t('quickCalories.calories')}
                  unit={unitLabel}
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  error={caloriesError}
                  keyboardType="number-pad"
                  returnKeyType="next"
                  onSubmitEditing={() => noteRef.current?.focus()}
                  submitBehavior="submit"
                  autoFocus
                  maxLength={6}
                  testID="quick-calories-kcal"
                />
              )}
            />
            <Controller
              control={control}
              name="note"
              render={({ field }) => (
                <FormField
                  ref={noteRef}
                  label={t('quickCalories.note')}
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  maxLength={QUICK_CALORIES_NOTE_MAX}
                  returnKeyType="done"
                  onSubmitEditing={() => void handleSubmit(submit)()}
                  testID="quick-calories-note"
                />
              )}
            />
          </View>
          {/* Date is display-only (moving between dates is not in scope). */}
          <ListRow
            label={t('quickCalories.date')}
            value={formatShortDate(date, today, locale)}
            testID="quick-calories-date"
          />
          {mode.kind === 'edit' ? (
            // UX-00: danger text action at the end of the content, never next to the primary.
            <View style={{ paddingHorizontal: theme.spacing[2] }}>
              <TextAction
                label={t('quickCalories.delete')}
                tone="danger"
                icon="trash-outline"
                onPress={() => setConfirmingDelete(true)}
                disabled={busy}
                testID="quick-calories-delete"
              />
            </View>
          ) : null}
        </ScrollView>
        <View
          style={{
            paddingHorizontal: theme.spacing[4],
            paddingVertical: theme.spacing[3],
            gap: theme.spacing[2],
            backgroundColor: theme.colors.canvas,
          }}
        >
          {failure ? (
            <InlineStatus
              tone="error"
              message={failure === 'save' ? t('quickCalories.saveError') : t('quickCalories.deleteError')}
              testID="quick-calories-failure"
            />
          ) : null}
          <PrimaryButton
            label={mode.kind === 'add' ? t('quickCalories.add') : t('quickCalories.save')}
            onPress={() => void handleSubmit(submit)()}
            disabled={!canSubmit}
            loading={isSubmitting || busy}
            fullWidth
            testID="quick-calories-submit"
          />
        </View>
      </KeyboardAvoidingView>
      <MealPicker
        visible={pickingMeal}
        meals={meals}
        selectedId={mealId}
        onSelect={(id) => {
          setValue('mealId', id, { shouldDirty: true, shouldValidate: true });
          setPickingMeal(false);
        }}
        onClose={() => setPickingMeal(false)}
      />
      {entry ? (
        <ConfirmationDialog
          visible={confirmingDelete}
          title={t('quickCalories.deleteTitle')}
          body={t('quickCalories.deleteBody', {
            energy: t('diary.meal.energy', {
              value: formatEnergy(entry.nutrients.energyKcal, unit, locale),
              unit: unitLabel,
            }),
            meal: mealName(entry.mealId),
            date: formatShortDate(entry.diaryDate, today, locale),
          })}
          confirmLabel={t('quickCalories.delete')}
          cancelLabel={t('common.cancel')}
          destructive
          onConfirm={() => void remove()}
          onCancel={() => setConfirmingDelete(false)}
          testID="quick-calories-delete-dialog"
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
