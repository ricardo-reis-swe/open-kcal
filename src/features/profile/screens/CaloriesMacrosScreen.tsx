import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, ScrollView, View, type TextInput } from 'react-native';

import {
  GOAL_MACRO_MAX_G,
  goalCaloriesRange,
  macroEnergyShare,
  parseGoalCalories,
  parseGoalMacro,
  type GoalMacroKey,
  type NutritionGoal,
  type NutritionTargets,
} from '@/domain/nutrition/goals';
import { energyFromKcal, type EnergyUnit } from '@/domain/units/units';
import { useAppSettings } from '@/features/diary/diary.queries';
import { AppBar, AppText, ConfirmationDialog, FormField, InlineStatus, PrimaryButton } from '@/shared/components';
import { formatInteger } from '@/shared/i18n/format';
import { useFormattingLocale } from '@/shared/i18n/useFormattingLocale';
import { useTheme } from '@/shared/theme';

import { useCurrentGoal, useSaveGoals } from '../profile.queries';

/**
 * Hook the route injects so system back / swipe-back run the same dirty-exit path as the app bar back (ARCH-06):
 * while `enabled`, a removal attempt calls `onAttempt(proceed)` instead of leaving.
 */
export type ExitGuardHook = (enabled: boolean, onAttempt: (proceed: () => void) => void) => void;

const noExitGuard: ExitGuardHook = () => {};

type Props = {
  /** After a successful save (NAV-06: Save → Profile). */
  onSaved: () => void;
  onCancel: () => void;
  useExitGuard?: ExitGuardHook;
};

type FieldKey = 'calories' | 'carbs' | 'protein' | 'fat';
type Values = Record<FieldKey, string>;

const MACROS: readonly { field: Exclude<FieldKey, 'calories'>; macro: GoalMacroKey }[] = [
  { field: 'carbs', macro: 'carbohydrateG' },
  { field: 'protein', macro: 'proteinG' },
  { field: 'fat', macro: 'fatG' },
];
const FIELDS: readonly FieldKey[] = ['calories', 'carbs', 'protein', 'fat'];

/** UX-16 Calories & Macros: edit the kcal/carb/protein/fat goals (NAV-06, DATA-09; UX-01 first save). */
export function CaloriesMacrosScreen(props: Props) {
  const theme = useTheme();
  const settings = useAppSettings();
  const goal = useCurrentGoal();
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.canvas }}>
      {settings.data && goal.isSuccess ? (
        <GoalsForm
          {...props}
          goal={goal.data}
          energyUnit={settings.data.energyUnit}
          provisional={settings.data.goalsConfirmedAt === null}
        />
      ) : null}
    </View>
  );
}

function initialValues(goal: NutritionGoal | null, unit: EnergyUnit): Values {
  if (!goal) return { calories: '', carbs: '', protein: '', fat: '' };
  return {
    calories: String(Math.round(energyFromKcal(goal.calorieTargetKcal, unit))),
    carbs: String(Math.round(goal.carbohydrateTargetG)),
    protein: String(Math.round(goal.proteinTargetG)),
    fat: String(Math.round(goal.fatTargetG)),
  };
}

function GoalsForm({
  goal,
  energyUnit,
  provisional,
  onSaved,
  onCancel,
  useExitGuard = noExitGuard,
}: Props & { goal: NutritionGoal | null; energyUnit: EnergyUnit; provisional: boolean }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const locale = useFormattingLocale();
  const save = useSaveGoals();
  const [initial] = useState(() => initialValues(goal, energyUnit));
  const [values, setValues] = useState<Values>(initial);
  const [touched, setTouched] = useState<Partial<Record<FieldKey, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  // Open Discard dialog; `proceed` resumes an intercepted system back, `null` = our own app bar back.
  const [discard, setDiscard] = useState<{ proceed: (() => void) | null } | null>(null);
  const [exit, setExit] = useState<'saved' | 'cancelled' | null>(null);
  const refs = useRef<Partial<Record<FieldKey, TextInput | null>>>({});

  const calorieKcal = parseGoalCalories(values.calories, energyUnit);
  const macroG = {
    carbs: parseGoalMacro(values.carbs),
    protein: parseGoalMacro(values.protein),
    fat: parseGoalMacro(values.fat),
  };
  const valid = calorieKcal !== null && macroG.carbs !== null && macroG.protein !== null && macroG.fat !== null;
  const dirty = FIELDS.some((field) => values[field] !== initial[field]);
  // UX-00: in edit mode Save waits for a change. UX-01: while goals are provisional, saving them unchanged is the
  // user confirming the defaults, so it is allowed.
  const canSave = valid && (dirty || provisional) && !save.isPending;

  // Leave (once) only after a re-render has lifted the guard, so our own exits aren't intercepted.
  const left = useRef(false);
  useEffect(() => {
    if (exit === null || left.current) return;
    left.current = true;
    if (exit === 'saved') onSaved();
    else onCancel();
  }, [exit, onSaved, onCancel]);

  useExitGuard(dirty && exit === null, (proceed) => setDiscard({ proceed }));

  const requestCancel = () => {
    if (!dirty) return onCancel();
    setDiscard({ proceed: null });
  };
  const confirmDiscard = () => {
    const proceed = discard?.proceed;
    setDiscard(null);
    if (proceed) proceed();
    else setExit('cancelled');
  };

  const submit = async () => {
    setSubmitted(true);
    if (!canSave || calorieKcal === null || macroG.carbs === null || macroG.protein === null || macroG.fat === null) {
      return;
    }
    // An untouched Calories field keeps the stored kcal, so a kJ round trip can't drift it.
    const targets: NutritionTargets = {
      calorieTargetKcal: values.calories === initial.calories && goal ? goal.calorieTargetKcal : calorieKcal,
      carbohydrateTargetG: macroG.carbs,
      proteinTargetG: macroG.protein,
      fatTargetG: macroG.fat,
    };
    setSaveFailed(false);
    try {
      await save.mutateAsync(targets);
      setExit('saved');
    } catch {
      setSaveFailed(true); // UX-00: stay, keep the input.
    }
  };

  const invalid: Record<FieldKey, boolean> = {
    calories: calorieKcal === null,
    carbs: macroG.carbs === null,
    protein: macroG.protein === null,
    fat: macroG.fat === null,
  };
  const showError = (field: FieldKey) => invalid[field] && (touched[field] || submitted);
  const range = goalCaloriesRange(energyUnit);
  const unitLabel = t(`units.${energyUnit}`);
  const caloriesError = t('caloriesMacros.errors.calories', {
    min: formatInteger(range.min, locale),
    max: formatInteger(range.max, locale),
    unit: unitLabel,
  });
  const macroError = t('caloriesMacros.errors.macro', { max: formatInteger(GOAL_MACRO_MAX_G, locale) });

  const helper = (field: Exclude<FieldKey, 'calories'>, macro: GoalMacroKey) => {
    const grams = macroG[field];
    if (grams === null) return undefined;
    const share = macroEnergyShare(grams, macro, calorieKcal);
    const energy = formatInteger(Math.round(energyFromKcal(share.kcal, energyUnit)), locale);
    return share.percent === null
      ? t('caloriesMacros.helperNoPercent', { energy, unit: unitLabel })
      : t('caloriesMacros.helper', {
          energy,
          unit: unitLabel,
          percent: formatInteger(Math.round(share.percent), locale),
        });
  };

  const field = (key: FieldKey, label: string, unit: string, error: string, helperText?: string, next?: FieldKey) => (
    <FormField
      key={key}
      ref={(input) => {
        refs.current[key] = input;
      }}
      label={label}
      value={values[key]}
      onChangeText={(text) => setValues((v) => ({ ...v, [key]: text }))}
      onBlur={() => setTouched((v) => ({ ...v, [key]: true }))}
      keyboardType="number-pad"
      returnKeyType={next ? 'next' : 'done'}
      onSubmitEditing={() => (next ? refs.current[next]?.focus() : void submit())}
      submitBehavior={next ? 'submit' : 'blurAndSubmit'}
      unit={unit}
      helper={helperText}
      error={showError(key) ? error : undefined}
      testID={`goals-${key}`}
    />
  );

  return (
    <View style={{ flex: 1 }}>
      <AppBar title={t('caloriesMacros.title')} back={{ label: t('common.back'), onPress: requestCancel }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView
          style={{ flex: 1 }}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: theme.spacing[4], gap: theme.spacing[4] }}
        >
          {field('calories', t('caloriesMacros.calories'), unitLabel, caloriesError, undefined, 'carbs')}
          {MACROS.map(({ field: key, macro }, i) =>
            field(key, t(`caloriesMacros.${key}`), t('units.g'), macroError, helper(key, macro), MACROS[i + 1]?.field),
          )}
          {/* DATA-09 footnote; while provisional the first save applies from day one instead (UX-01). */}
          {provisional ? null : (
            <AppText variant="compact" color="textSecondary" testID="goals-footnote">
              {t('caloriesMacros.footnote')}
            </AppText>
          )}
        </ScrollView>
        <View style={{ padding: theme.spacing[4], gap: theme.spacing[2], backgroundColor: theme.colors.canvas }}>
          {saveFailed ? <InlineStatus tone="error" message={t('caloriesMacros.saveError')} /> : null}
          <PrimaryButton
            label={t('caloriesMacros.save')}
            onPress={() => void submit()}
            disabled={!canSave}
            loading={save.isPending}
            fullWidth
            testID="goals-save"
          />
        </View>
      </KeyboardAvoidingView>
      <ConfirmationDialog
        visible={discard !== null}
        title={t('caloriesMacros.discardTitle')}
        confirmLabel={t('caloriesMacros.discard')}
        cancelLabel={t('caloriesMacros.keepEditing')}
        destructive
        onConfirm={confirmDiscard}
        onCancel={() => setDiscard(null)}
        testID="goals-discard"
      />
    </View>
  );
}
