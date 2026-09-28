import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';

import type { Meal } from '@/data/db/repositories/mealsRepository';
import { duplicateMealName, isValidMealName } from '@/domain/meals/meals';
import { useMeals } from '@/features/diary/diary.queries';
import {
  AppBar,
  AppIcon,
  AppText,
  BottomSheet,
  ConfirmationDialog,
  FocusablePressable,
  FormField,
  InlineStatus,
  NotFoundState,
  PrimaryButton,
  TextAction,
} from '@/shared/components';
import { NotFoundError } from '@/shared/errors';
import { useTheme } from '@/shared/theme';

import { useMeal, useMealEntryCount, useMealWrites } from '../profile.queries';

type Props = {
  /** `null` = bad route params (UX-00 not found). */
  params: { mode: 'create' } | { mode: 'edit'; mealId: string } | null;
  /** NAV-06: Save → Meals; a delete also returns to Meals. */
  onDone: () => void;
  /** Leaving a dirty form silently discards (UX-00: only Create Custom Food and Calories & Macros ask). */
  onBack: () => void;
  /** UX-00 not found: back to the stack root. */
  onNotFound: () => void;
};

/** UX-17 / NAV-06 Add / Edit Meal: one Name field; Delete meal in edit mode (UX-19, NAV-08, DATA-10). */
export function MealEditScreen({ params, onDone, onBack, onNotFound }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const editId = params?.mode === 'edit' ? params.mealId : null;
  // After a delete this screen is leaving; the meal's own queries must not refetch into a not-found state.
  const [deleting, setDeleting] = useState(false);
  const meal = useMeal(editId ?? '', editId !== null && !deleting);
  const meals = useMeals();
  // Keeps the form up while a delete removes the meal's query (React "adjust state on change" pattern).
  const [shownMeal, setShownMeal] = useState<Meal | null>(null);
  if (meal.data && meal.data !== shownMeal) setShownMeal(meal.data);

  const title = t(editId ? 'mealEdit.editTitle' : 'mealEdit.addTitle');
  const notFound = params === null || (!deleting && meal.error instanceof NotFoundError);
  const shown = editId ? shownMeal : null;
  const ready = meals.data && (editId === null || shown !== null);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.canvas }}>
      {notFound ? (
        <>
          <AppBar title={title} back={{ label: t('common.back'), onPress: onBack }} />
          <NotFoundState actionLabel={t('common.back')} onAction={onNotFound} />
        </>
      ) : ready ? (
        <MealForm
          title={title}
          meal={shown}
          meals={meals.data}
          onDone={onDone}
          onBack={onBack}
          onDeleting={setDeleting}
        />
      ) : null}
    </View>
  );
}

function MealForm({
  title,
  meal,
  meals,
  onDone,
  onBack,
  onDeleting,
}: {
  title: string;
  meal: Meal | null;
  meals: readonly Meal[];
  onDone: () => void;
  onBack: () => void;
  onDeleting: (deleting: boolean) => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const writes = useMealWrites();
  const entryCount = useMealEntryCount(meal?.id ?? '', meal !== null);
  const initial = meal?.name ?? '';
  const [name, setName] = useState(initial);
  const [touched, setTouched] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [deleteFailed, setDeleteFailed] = useState(false);
  const [confirm, setConfirm] = useState<'dialog' | 'sheet' | null>(null);
  const [target, setTarget] = useState<string | null>(null);

  const valid = isValidMealName(name);
  const dirty = name.trim() !== initial.trim();
  const pending = writes.create.isPending || writes.rename.isPending || writes.remove.isPending;
  const canSave = valid && (meal === null || dirty) && !pending;
  const duplicate = duplicateMealName(meals, name, meal?.id);
  const others = meals.filter((m) => m.id !== meal?.id);
  const count = entryCount.data ?? 0;

  const submit = async () => {
    setSubmitted(true);
    if (!canSave) return;
    setSaveFailed(false);
    try {
      if (meal) await writes.rename.mutateAsync({ id: meal.id, name: name.trim() });
      else await writes.create.mutateAsync(name.trim()); // UX-17: new meals append at the end (repository).
      onDone();
    } catch {
      setSaveFailed(true); // UX-00: stay, keep the input.
    }
  };

  const requestDelete = () => {
    if (!entryCount.isSuccess) return;
    setTarget(null);
    setConfirm(count > 0 ? 'sheet' : 'dialog');
  };

  const remove = async (targetMealId: string | null) => {
    if (!meal) return;
    setConfirm(null);
    setDeleteFailed(false);
    onDeleting(true);
    try {
      await writes.remove.mutateAsync({ id: meal.id, targetMealId });
      onDone();
    } catch {
      onDeleting(false);
      setDeleteFailed(true);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <AppBar title={title} back={{ label: t('common.back'), onPress: onBack }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView
          style={{ flex: 1 }}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: theme.spacing[4], gap: theme.spacing[4] }}
        >
          <FormField
            label={t('mealEdit.name')}
            value={name}
            onChangeText={setName}
            onBlur={() => setTouched(true)}
            autoFocus
            autoCapitalize="sentences"
            returnKeyType="done"
            submitBehavior="blurAndSubmit"
            onSubmitEditing={() => void submit()}
            error={!valid && (touched || submitted) ? t('mealEdit.nameError') : undefined}
            testID="meal-name"
          />
          {duplicate ? (
            <InlineStatus
              tone="warning"
              message={t('mealEdit.duplicate', { name: duplicate })}
              testID="meal-duplicate"
            />
          ) : null}
          {meal ? (
            <View style={{ gap: theme.spacing[1], marginTop: theme.spacing[4] }}>
              <TextAction
                label={t('mealEdit.delete')}
                tone="danger"
                icon="trash-outline"
                onPress={requestDelete}
                disabled={others.length === 0 || pending}
                testID="meal-delete"
              />
              {others.length === 0 ? (
                <AppText variant="compact" color="textSecondary" testID="meal-last-helper">
                  {t('mealEdit.lastMeal')}
                </AppText>
              ) : null}
              {deleteFailed ? <InlineStatus tone="error" message={t('mealEdit.deleteError')} /> : null}
            </View>
          ) : null}
        </ScrollView>
        <View style={{ padding: theme.spacing[4], gap: theme.spacing[2], backgroundColor: theme.colors.canvas }}>
          {saveFailed ? <InlineStatus tone="error" message={t('mealEdit.saveError')} /> : null}
          <PrimaryButton
            label={t('mealEdit.save')}
            onPress={() => void submit()}
            disabled={!canSave}
            loading={writes.create.isPending || writes.rename.isPending}
            fullWidth
            testID="meal-save"
          />
        </View>
      </KeyboardAvoidingView>
      {meal ? (
        <>
          <ConfirmationDialog
            visible={confirm === 'dialog'}
            title={t('mealEdit.deleteTitle', { name: meal.name })}
            confirmLabel={t('mealEdit.deleteConfirm')}
            cancelLabel={t('common.cancel')}
            destructive
            onConfirm={() => void remove(null)}
            onCancel={() => setConfirm(null)}
            testID="meal-delete-dialog"
          />
          <MoveEntriesSheet
            visible={confirm === 'sheet'}
            mealName={meal.name}
            count={count}
            others={others}
            target={target}
            onSelect={setTarget}
            onConfirm={() => void (target ? remove(target) : undefined)}
            onClose={() => setConfirm(null)}
          />
        </>
      ) : null}
    </View>
  );
}

/** UX-19 Delete meal with entries: pick the meal that receives them, then `Delete and move entries` (DATA-10). */
function MoveEntriesSheet({
  visible,
  mealName,
  count,
  others,
  target,
  onSelect,
  onConfirm,
  onClose,
}: {
  visible: boolean;
  mealName: string;
  count: number;
  others: readonly Meal[];
  target: string | null;
  onSelect: (id: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const title = t('mealEdit.moveTitle', { name: mealName, count });
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      accessibilityLabel={title}
      closeLabel={t('common.close')}
      testID="meal-move-sheet"
    >
      <AppText
        variant="bodyStrong"
        accessibilityRole="header"
        style={{ paddingHorizontal: theme.spacing[4], paddingBottom: theme.spacing[2] }}
      >
        {title}
      </AppText>
      <ScrollView bounces={false} accessibilityRole="radiogroup">
        {others.map((m) => {
          const selected = m.id === target;
          return (
            <FocusablePressable
              key={m.id}
              onPress={() => onSelect(m.id)}
              accessibilityRole="radio"
              accessibilityLabel={m.name}
              accessibilityState={{ checked: selected }}
              testID={`meal-move-${m.id}`}
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
              <AppIcon
                name={selected ? 'radio-button-on' : 'radio-button-off'}
                color={selected ? 'primary' : 'textSecondary'}
              />
              <AppText variant="body" numberOfLines={2} style={styles.label}>
                {m.name}
              </AppText>
            </FocusablePressable>
          );
        })}
      </ScrollView>
      <View style={{ paddingHorizontal: theme.spacing[2], paddingTop: theme.spacing[2] }}>
        <TextAction
          label={t('mealEdit.moveConfirm')}
          tone="danger"
          onPress={onConfirm}
          disabled={target === null}
          testID="meal-move-confirm"
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  label: { flex: 1 },
});
