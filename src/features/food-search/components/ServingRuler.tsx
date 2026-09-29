import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, useWindowDimensions, View } from 'react-native';
import { RulerPicker } from 'react-native-legend-ruler-picker';

import type { FoodServing } from '@/data/db/repositories/foodsRepository';
import { adjustRulerQuantity, rulerSpec, snapRulerQuantity } from '@/domain/food/servings';
import type { EnergyUnit } from '@/domain/units/units';
import { AppText } from '@/shared/components';
import { FocusablePressable } from '@/shared/components/FocusablePressable';
import { formatEnergy } from '@/shared/i18n/format';
import { useFormattingLocale } from '@/shared/i18n/useFormattingLocale';
import { useTheme } from '@/shared/theme';

const RULER_HEIGHT = 80;
const LONG_STEP_HEIGHT = 35;
const MINIMUM_STEPS = 2_000;
/** The library always renders its own value label; this collapses it so the DS-09 value chip stays the only one. */
const HIDDEN_LABEL = { fontSize: 1, color: 'transparent' } as const;
/**
 * DS-09 fling weight: lighter friction than RN's `fast` preset (iOS 0.99, Android 0.9), so a flick carries about
 * twice as far before it snaps to a tick (user feedback 2026-09-29). Android sits above `normal` because a flick
 * there still felt dead at 0.96 (user feedback 2026-09-29). Tune here; `normal` is 0.998 / 0.985. Higher = more glide.
 */
export const RULER_DECELERATION_RATE = Platform.select({ ios: 0.995, default: 0.992 });

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
 * DS-09 / UX-05: serving ruler on `react-native-legend-ruler-picker`, with a fixed pointer and accessible
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
  const lastServingId = useRef(serving.id);
  const lastHapticAt = useRef(0);
  const { step } = rulerSpec(serving);
  const minimum = step;
  // Fixed per mount: the picker only reads initialValue when it mounts.
  const [mount, setMount] = useState(() => ({ key: 0, index: rulerIndex(quantity, step) }));
  const maximumIndex = Math.max(MINIMUM_STEPS, mount.index + 1_000);
  const rulerWidth = Math.max(1, windowWidth - theme.spacing[8]);
  const energy = formatEnergy(energyKcal, energyUnit, locale);
  const spokenUnit = t(`diary.units.${energyUnit}Spoken`);
  const label = t('servingRuler.a11y', {
    quantity: displayQuantity(quantity, locale),
    serving: serving.label,
    energy,
    unit: spokenUnit,
  });

  useEffect(() => {
    if (quantity === last.current && serving.id === lastServingId.current) return;
    last.current = quantity;
    lastServingId.current = serving.id;
    setMount((current) => ({ key: current.key + 1, index: rulerIndex(quantity, step) }));
  }, [quantity, serving.id, step]);

  const emit = useCallback(
    (next: number) => {
      if (next === last.current) return;
      last.current = next;
      onChange(next);
      const now = Date.now();
      if (process.env.NODE_ENV !== 'test' && now - lastHapticAt.current >= 50) {
        lastHapticAt.current = now;
        onHaptic?.();
      }
    },
    [onChange, onHaptic],
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
          unit=" "
          valueTextStyle={HIDDEN_LABEL}
          unitTextStyle={HIDDEN_LABEL}
          stepWidth={2}
          gapBetweenSteps={16}
          shortStepHeight={12}
          longStepHeight={LONG_STEP_HEIGHT}
          shortStepColor={theme.colors.onPrimary}
          longStepColor={theme.colors.onPrimary}
          indicatorHeight={LONG_STEP_HEIGHT}
          indicatorColor={theme.colors.canvas}
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
