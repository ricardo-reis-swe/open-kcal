import * as Haptics from 'expo-haptics';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, useWindowDimensions, View } from 'react-native';
import { RulerPicker } from 'react-native-ruler-picker';

import type { FoodServing } from '@/data/db/repositories/foodsRepository';
import { adjustRulerQuantity, rulerSpec, snapRulerQuantity } from '@/domain/food/servings';
import type { EnergyUnit } from '@/domain/units/units';
import { AppText } from '@/shared/components';
import { FocusablePressable } from '@/shared/components/FocusablePressable';
import { formatEnergy } from '@/shared/i18n/format';
import { useFormattingLocale } from '@/shared/i18n/useFormattingLocale';
import { useTheme } from '@/shared/theme';

// DS-09 geometry, measured from the reference ruler (Runtastic Balance) on 2026-09-29.
const RULER_HEIGHT = 90;
const STEP_WIDTH = 1;
const STEP_GAP = 23; // 24 between ticks
const SHORT_STEP_HEIGHT = 13;
const LONG_STEP_HEIGHT = 38;
const STEP_LABEL_TOP = 46;
const MINIMUM_STEPS = 2_000;
/**
 * DS-09 fling weight, measured from the reference ruler: its fling matches Android's OverScroller with friction
 * 0.004 (RN Android uses friction = 1 - rate), and ~0.998 per ms on iOS. Higher = more glide.
 */
export const RULER_DECELERATION_RATE = Platform.select({ ios: 0.998, default: 0.996 });

type Props = {
  quantity: number;
  serving: FoodServing;
  energyKcal: number;
  energyUnit: EnergyUnit;
  onChange: (quantity: number) => void;
  onOpenNumeric: () => void;
  /** Optional native feedback adapter; deliberately injected so the pure control stays test-safe. */
  onHaptic?: () => void;
};

const nativeTickHaptic = () => {
  void (Platform.OS === 'android'
    ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Segment_Frequent_Tick)
    : Haptics.selectionAsync());
};

/** Picker index 0 is one step: the ruler's minimum (0 can't be saved, UX-05). */
function rulerIndex(value: number, step: number): number {
  return Math.max(0, Math.round((value - step) / step));
}

function displayQuantity(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 2, useGrouping: false }).format(value);
}

function displaySelectedQuantity(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: false,
  }).format(value);
}

/**
 * DS-09 / UX-05: serving ruler on `react-native-ruler-picker`, with a fixed pointer and accessible
 * alternatives. The picker works in step indexes (0…max) and is uncontrolled, so a value set from outside the
 * ruler (a11y action, numeric entry, serving change) remounts it at the new index.
 */
export function ServingRuler({
  quantity,
  serving,
  energyKcal,
  energyUnit,
  onChange,
  onOpenNumeric,
  onHaptic = nativeTickHaptic,
}: Props) {
  const { t } = useTranslation();
  const locale = useFormattingLocale();
  const theme = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const last = useRef(quantity);
  const lastHapticAt = useRef(0);
  const { step, majorStep } = rulerSpec(serving);
  const minimum = step;
  const majorEvery = Math.max(1, Math.round(majorStep / step));
  // Fixed per mount: the picker only reads initialValue when it mounts.
  const [mount, setMount] = useState(() => ({
    key: 0,
    index: rulerIndex(quantity, step),
    quantity,
    servingId: serving.id,
  }));
  // Sync externally-set values during rendering so React discards the stale tree before it reaches the screen. This
  // prevents a serving change from briefly showing the old unit's index (for example, 2 eggs as 8 g).
  if (quantity !== mount.quantity || serving.id !== mount.servingId) {
    setMount({ key: mount.key + 1, index: rulerIndex(quantity, step), quantity, servingId: serving.id });
  }
  const maximumIndex = Math.max(MINIMUM_STEPS, mount.index + 1_000);
  const rulerWidth = Math.max(1, windowWidth);
  const energy = formatEnergy(energyKcal, energyUnit, locale);
  const spokenUnit = t(`diary.units.${energyUnit}Spoken`);
  const label = t('servingRuler.a11y', {
    quantity: displayQuantity(quantity, locale),
    serving: serving.label,
    energy,
    unit: spokenUnit,
  });

  const emit = useCallback(
    (next: number) => {
      if (next === last.current) return;
      last.current = next;
      // Keep the picker uncontrolled while it is dragged; the parent update then matches this state and does not
      // trigger a costly remount for every tick.
      setMount((current) => ({ ...current, quantity: next, servingId: serving.id }));
      onChange(next);
      const now = Date.now();
      if (process.env.NODE_ENV !== 'test' && now - lastHapticAt.current >= 50) {
        lastHapticAt.current = now;
        onHaptic?.();
      }
    },
    [onChange, onHaptic, serving.id],
  );

  // Index i is (i + 1) steps, so majors land on whole multiples of majorStep.
  const stepLabel = useCallback(
    (index: number) => displayQuantity(snapRulerQuantity(minimum + index * step, serving), locale),
    [locale, minimum, serving, step],
  );
  const stepLabelStyle = useMemo(
    () => ({ ...theme.typography.body, color: theme.colors.onPrimary }),
    [theme.colors.onPrimary, theme.typography.body],
  );

  const emitIndex = useCallback(
    (index: string) => emit(snapRulerQuantity(minimum + Number(index) * step, serving)),
    [emit, minimum, serving, step],
  );

  return (
    <View style={{ gap: theme.spacing[4] }}>
      <FocusablePressable
        accessibilityRole="button"
        accessibilityLabel={t('servingRuler.editValue', {
          value: `${displayQuantity(quantity, locale)} ${serving.label}`,
        })}
        onPress={onOpenNumeric}
        testID="serving-ruler-value"
        style={{
          alignSelf: 'center',
          minWidth: 100,
          alignItems: 'center',
          borderWidth: 1,
          borderColor: theme.colors.primary,
          borderRadius: theme.radii.small,
          backgroundColor: theme.colors.canvas,
          paddingHorizontal: theme.spacing[4],
          paddingVertical: theme.spacing[2],
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: theme.spacing[1] }}>
          <AppText variant="displayNumber" tabular align="right" style={{ minWidth: 80 }}>
            {displaySelectedQuantity(quantity, locale)}
          </AppText>
          <AppText variant="compact" color="textSecondary">
            {serving.label}
          </AppText>
        </View>
      </FocusablePressable>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ min: step, now: quantity, text: label }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(event) => {
          const action = event.nativeEvent.actionName;
          // Goes straight to onChange (not emit) so the quantity effect remounts the ruler at the new value.
          if (action === 'increment' || action === 'decrement') {
            const next = adjustRulerQuantity(quantity, action, serving);
            if (next !== quantity) onChange(next);
          }
        }}
        testID="serving-ruler"
        style={{ height: RULER_HEIGHT, overflow: 'hidden', backgroundColor: theme.colors.primary }}
      >
        <RulerPicker
          key={mount.key}
          width={rulerWidth}
          height={RULER_HEIGHT}
          min={0}
          max={maximumIndex}
          step={1}
          initialValue={mount.index}
          fractionDigits={0}
          hideValue
          stepsAlign="top"
          stepWidth={STEP_WIDTH}
          gapBetweenSteps={STEP_GAP}
          shortStepHeight={SHORT_STEP_HEIGHT}
          longStepHeight={LONG_STEP_HEIGHT}
          longStepEvery={majorEvery}
          longStepOffset={1}
          shortStepColor={theme.colors.onPrimary}
          longStepColor={theme.colors.onPrimary}
          stepLabel={stepLabel}
          stepLabelStyle={stepLabelStyle}
          stepLabelTop={STEP_LABEL_TOP}
          indicatorHeight={0}
          decelerationRate={RULER_DECELERATION_RATE}
          onValueChange={emitIndex}
          onValueChangeEnd={emitIndex}
        />
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            alignSelf: 'center',
            top: 0,
            width: 0,
            height: 0,
            borderLeftWidth: 8,
            borderRightWidth: 8,
            borderTopWidth: 9,
            borderLeftColor: 'transparent',
            borderRightColor: 'transparent',
            borderTopColor: theme.colors.canvas,
          }}
        />
      </View>
    </View>
  );
}
