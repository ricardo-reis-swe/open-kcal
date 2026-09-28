import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, ScrollView, View, type TextInput } from 'react-native';

import {
  GOAL_MACRO_MAX_G,
  GOAL_MACRO_MAX_PERCENT,
  gramsFromMacroPercent,
  goalCaloriesRange,
  macroEnergyShare,
  parseGoalCalories,
  parseGoalMacro,
  parseGoalMacroPercent,
  percentagesFromMacroGrams,
  type GoalMacroKey,
  type MacroTargetMode,
  type NutritionGoal,
  type NutritionTargets,
} from '@/domain/nutrition/goals';
import { energyFromKcal, type EnergyUnit } from '@/domain/units/units';
import { useAppSettings } from '@/features/diary/diary.queries';
import {
  AppBar,
  AppText,
  ConfirmationDialog,
  FormField,
  HeaderAction,
  InlineStatus,
  TextAction,
} from '@/shared/components';
import { formatGrams, formatInteger } from '@/shared/i18n/format';
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

function initialForm(goal: NutritionGoal | null, unit: EnergyUnit): { mode: MacroTargetMode; values: Values } {
  if (!goal) return { mode: 'grams', values: { calories: '', carbs: '', protein: '', fat: '' } };
  const mode = goal.macroTargetMode;
  const percentages =
    mode === 'percent' &&
    goal.carbohydrateTargetPercent !== null &&
    goal.proteinTargetPercent !== null &&
    goal.fatTargetPercent !== null
      ? {
          carbohydrateG: goal.carbohydrateTargetPercent,
          proteinG: goal.proteinTargetPercent,
          fatG: goal.fatTargetPercent,
        }
      : percentagesFromMacroGrams(goal.carbohydrateTargetG, goal.proteinTargetG, goal.fatTargetG);
  return {
    mode,
    values: {
      calories: String(Math.round(energyFromKcal(goal.calorieTargetKcal, unit))),
      carbs: String(Math.round(mode === 'percent' ? percentages.carbohydrateG : goal.carbohydrateTargetG)),
      protein: String(Math.round(mode === 'percent' ? percentages.proteinG : goal.proteinTargetG)),
      fat: String(Math.round(mode === 'percent' ? percentages.fatG : goal.fatTargetG)),
    },
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
  const [initial] = useState(() => initialForm(goal, energyUnit));
  const [mode, setMode] = useState<MacroTargetMode>(initial.mode);
  const [values, setValues] = useState<Values>(initial.values);
  const [touched, setTouched] = useState<Partial<Record<FieldKey, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  // Open Discard dialog; `proceed` resumes an intercepted system back, `null` = our own app bar back.
  const [discard, setDiscard] = useState<{ proceed: (() => void) | null } | null>(null);
  const [exit, setExit] = useState<'saved' | 'cancelled' | null>(null);
  const refs = useRef<Partial<Record<FieldKey, TextInput | null>>>({});

  const calorieKcal = parseGoalCalories(values.calories, energyUnit);
  const macroInput = {
    carbs: mode === 'grams' ? parseGoalMacro(values.carbs) : parseGoalMacroPercent(values.carbs),
    protein: mode === 'grams' ? parseGoalMacro(values.protein) : parseGoalMacroPercent(values.protein),
    fat: mode === 'grams' ? parseGoalMacro(values.fat) : parseGoalMacroPercent(values.fat),
  };
  const percentTotal =
    mode === 'percent' ? Object.values(macroInput).reduce<number>((sum, value) => sum + (value ?? 0), 0) : null;
  const percentagesValid = mode === 'grams' || percentTotal === 100;
  const macroG = {
    carbs:
      macroInput.carbs === null || calorieKcal === null
        ? null
        : mode === 'grams'
          ? macroInput.carbs
          : gramsFromMacroPercent(calorieKcal, macroInput.carbs, 'carbohydrateG'),
    protein:
      macroInput.protein === null || calorieKcal === null
        ? null
        : mode === 'grams'
          ? macroInput.protein
          : gramsFromMacroPercent(calorieKcal, macroInput.protein, 'proteinG'),
    fat:
      macroInput.fat === null || calorieKcal === null
        ? null
        : mode === 'grams'
          ? macroInput.fat
          : gramsFromMacroPercent(calorieKcal, macroInput.fat, 'fatG'),
  };
  const valid =
    calorieKcal !== null && macroG.carbs !== null && macroG.protein !== null && macroG.fat !== null && percentagesValid;
  const dirty = mode !== initial.mode || FIELDS.some((field) => values[field] !== initial.values[field]);
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
      calorieTargetKcal: values.calories === initial.values.calories && goal ? goal.calorieTargetKcal : calorieKcal,
      macroTargetMode: mode,
      carbohydrateTargetG: macroG.carbs,
      proteinTargetG: macroG.protein,
      fatTargetG: macroG.fat,
      carbohydrateTargetPercent: mode === 'percent' ? macroInput.carbs : null,
      proteinTargetPercent: mode === 'percent' ? macroInput.protein : null,
      fatTargetPercent: mode === 'percent' ? macroInput.fat : null,
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
    carbs: macroInput.carbs === null,
    protein: macroInput.protein === null,
    fat: macroInput.fat === null,
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
  const percentError = t('caloriesMacros.errors.percent', { max: GOAL_MACRO_MAX_PERCENT });

  const helper = (field: Exclude<FieldKey, 'calories'>, macro: GoalMacroKey) => {
    const grams = macroG[field];
    if (grams === null) return undefined;
    const share = macroEnergyShare(grams, macro, calorieKcal);
    const energy = formatInteger(Math.round(energyFromKcal(share.kcal, energyUnit)), locale);
    if (mode === 'percent') {
      return t('caloriesMacros.helperPercent', { grams: formatGrams(grams, locale), energy, unit: unitLabel });
    }
    return share.percent === null
      ? t('caloriesMacros.helperNoPercent', { energy, unit: unitLabel })
      : t('caloriesMacros.helper', {
          energy,
          unit: unitLabel,
          percent: formatInteger(Math.round(share.percent), locale),
        });
  };

  const chooseMode = (next: MacroTargetMode) => {
    if (next === mode) return;
    if (next === 'percent') {
      const percentages = percentagesFromMacroGrams(
        parseGoalMacro(values.carbs) ?? 0,
        parseGoalMacro(values.protein) ?? 0,
        parseGoalMacro(values.fat) ?? 0,
      );
      setValues((current) => ({
        ...current,
        carbs: String(percentages.carbohydrateG),
        protein: String(percentages.proteinG),
        fat: String(percentages.fatG),
      }));
    } else {
      const kcal = parseGoalCalories(values.calories, energyUnit);
      setValues((current) => ({
        ...current,
        carbs: String(
          Math.round(gramsFromMacroPercent(kcal ?? 0, parseGoalMacroPercent(values.carbs) ?? 0, 'carbohydrateG')),
        ),
        protein: String(
          Math.round(gramsFromMacroPercent(kcal ?? 0, parseGoalMacroPercent(values.protein) ?? 0, 'proteinG')),
        ),
        fat: String(Math.round(gramsFromMacroPercent(kcal ?? 0, parseGoalMacroPercent(values.fat) ?? 0, 'fatG'))),
      }));
    }
    setMode(next);
    setTouched({});
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
      <AppBar
        title={t('caloriesMacros.title')}
        back={{ label: t('common.back'), onPress: requestCancel }}
        actions={
          <HeaderAction
            label={t('caloriesMacros.save')}
            onPress={() => void submit()}
            disabled={!canSave}
            loading={save.isPending}
            testID="goals-save"
          />
        }
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView
          style={{ flex: 1 }}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: theme.spacing[4], gap: theme.spacing[4] }}
        >
          {field('calories', t('caloriesMacros.calories'), unitLabel, caloriesError, undefined, 'carbs')}
          <View
            accessibilityRole="radiogroup"
            accessibilityLabel={t('caloriesMacros.modeLabel')}
            style={{ gap: theme.spacing[1] }}
          >
            <AppText variant="label" color="textSecondary">
              {t('caloriesMacros.modeLabel')}
            </AppText>
            <View style={{ flexDirection: 'row', gap: theme.spacing[4] }}>
              <TextAction
                label={t('caloriesMacros.modeGrams')}
                selected={mode === 'grams'}
                onPress={() => chooseMode('grams')}
                testID="goals-mode-grams"
              />
              <TextAction
                label={t('caloriesMacros.modePercent')}
                selected={mode === 'percent'}
                onPress={() => chooseMode('percent')}
                testID="goals-mode-percent"
              />
            </View>
          </View>
          {MACROS.map(({ field: key, macro }, i) =>
            field(
              key,
              t(`caloriesMacros.${key}`),
              mode === 'grams' ? t('units.g') : '%',
              mode === 'grams' ? macroError : percentError,
              helper(key, macro),
              MACROS[i + 1]?.field,
            ),
          )}
          {mode === 'percent' ? (
            <AppText
              variant="compact"
              color={percentagesValid ? 'textSecondary' : 'danger'}
              accessibilityLiveRegion="polite"
              testID="goals-percent-total"
            >
              {percentagesValid
                ? t('caloriesMacros.percentTotal', { total: percentTotal })
                : t('caloriesMacros.errors.percentTotal', { total: percentTotal })}
            </AppText>
          ) : null}
          {/* DATA-09 footnote; while provisional the first save applies from day one instead (UX-01). */}
          {provisional ? null : (
            <AppText variant="compact" color="textSecondary" testID="goals-footnote">
              {t('caloriesMacros.footnote')}
            </AppText>
          )}
          {saveFailed ? <InlineStatus tone="error" message={t('caloriesMacros.saveError')} /> : null}
        </ScrollView>
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
