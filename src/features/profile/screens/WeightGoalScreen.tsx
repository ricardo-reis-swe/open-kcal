import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, ScrollView, View } from 'react-native';

import { parseWeightInput, weightInputRange, weightInputText } from '@/domain/weight/weight';
import type { WeightUnit } from '@/domain/units/units';
import { useAppSettings } from '@/features/diary/diary.queries';
import { AppBar, FormField, InlineStatus, PrimaryButton, TextAction } from '@/shared/components';
import { useFormattingLocale } from '@/shared/i18n/useFormattingLocale';
import { useTheme } from '@/shared/theme';

import { useSetGoalWeight } from '../profile.queries';

type Props = {
  /** NAV-06: Save → Profile (also after `Clear goal`). */
  onSaved: () => void;
  /** A dirty form silently discards (UX-00: only Create Custom Food and Calories & Macros ask). */
  onBack: () => void;
};

/** UX-18 / NAV-06 Weight Goal: one weight field in `weight_unit` + `Clear goal` (sets NULL). */
export function WeightGoalScreen(props: Props) {
  const theme = useTheme();
  const settings = useAppSettings().data;
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.canvas }}>
      {settings ? <GoalForm {...props} goalKg={settings.goalWeightKg} unit={settings.weightUnit} /> : null}
    </View>
  );
}

function GoalForm({ goalKg, unit, onSaved, onBack }: Props & { goalKg: number | null; unit: WeightUnit }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const locale = useFormattingLocale();
  const save = useSetGoalWeight();
  const [initial] = useState(() => (goalKg === null ? '' : weightInputText(goalKg, unit, locale)));
  const [value, setValue] = useState(initial);
  const [touched, setTouched] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [done, setDone] = useState(false);

  const kg = parseWeightInput(value, unit, locale);
  const dirty = value !== initial;
  // UX-00: disabled until valid; with an existing goal (edit mode) also until something changed.
  const canSave = kg !== null && (goalKg === null || dirty) && !save.isPending;

  const left = useRef(false);
  useEffect(() => {
    if (!done || left.current) return;
    left.current = true;
    onSaved();
  }, [done, onSaved]);

  const write = async (next: number | null) => {
    setSaveFailed(false);
    try {
      await save.mutateAsync(next);
      setDone(true);
    } catch {
      setSaveFailed(true); // UX-00: stay, keep the input.
    }
  };

  const submit = () => {
    setSubmitted(true);
    if (canSave && kg !== null) void write(kg);
  };

  const range = weightInputRange(unit);
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const unitLabel = t(`units.${unit}`);
  const error =
    kg === null && (touched || submitted)
      ? t('weightGoal.error', { min: number.format(range.min), max: number.format(range.max), unit: unitLabel })
      : undefined;

  return (
    <View style={{ flex: 1 }}>
      <AppBar title={t('weightGoal.title')} back={{ label: t('common.back'), onPress: onBack }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView
          style={{ flex: 1 }}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: theme.spacing[4], gap: theme.spacing[4] }}
        >
          <FormField
            label={t('weightGoal.field')}
            value={value}
            onChangeText={setValue}
            onBlur={() => setTouched(true)}
            keyboardType="decimal-pad"
            returnKeyType="done"
            onSubmitEditing={submit}
            unit={unitLabel}
            error={error}
            testID="weight-goal-input"
          />
          {goalKg !== null ? (
            <TextAction
              label={t('weightGoal.clear')}
              onPress={() => void write(null)}
              disabled={save.isPending}
              testID="weight-goal-clear"
            />
          ) : null}
        </ScrollView>
        <View style={{ padding: theme.spacing[4], gap: theme.spacing[2], backgroundColor: theme.colors.canvas }}>
          {saveFailed ? <InlineStatus tone="error" message={t('weightGoal.saveError')} /> : null}
          <PrimaryButton
            label={t('weightGoal.save')}
            onPress={submit}
            disabled={!canSave}
            loading={save.isPending}
            fullWidth
            testID="weight-goal-save"
          />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
