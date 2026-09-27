import * as Haptics from 'expo-haptics';
import { useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { PanResponder, View } from 'react-native';

import type { FoodServing } from '@/data/db/repositories/foodsRepository';
import { adjustRulerQuantity, rulerSpec, snapRulerQuantity } from '@/domain/food/servings';
import type { EnergyUnit } from '@/domain/units/units';
import { AppText } from '@/shared/components';
import { FocusablePressable } from '@/shared/components/FocusablePressable';
import { formatEnergy } from '@/shared/i18n/format';
import { useFormattingLocale } from '@/shared/i18n/useFormattingLocale';
import { useTheme } from '@/shared/theme';

const PIXELS_PER_STEP = 18;
const TICK_OFFSETS = [-8, -7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8] as const;

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

const nativeSelectionHaptic = () => {
  void Haptics.selectionAsync();
};

function displayQuantity(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 2, useGrouping: false }).format(value);
}

/** DS-09 / UX-05: fixed-pointer serving ruler with snapped pan and adjustable accessibility actions. */
export function ServingRuler({
  quantity,
  serving,
  energyKcal,
  energyUnit,
  onChange,
  onOpenNumeric,
  onHaptic = nativeSelectionHaptic,
}: Props) {
  const { t } = useTranslation();
  const locale = useFormattingLocale();
  const theme = useTheme();
  const start = useRef(quantity);
  const last = useRef(quantity);
  const lastHapticAt = useRef(0);
  const { step, majorStep } = rulerSpec(serving);
  const energy = formatEnergy(energyKcal, energyUnit, locale);
  const spokenUnit = t(`diary.units.${energyUnit}Spoken`);
  const label = t('servingRuler.a11y', {
    quantity: displayQuantity(quantity, locale),
    serving: serving.label,
    energy,
    unit: spokenUnit,
  });

  const emit = (next: number) => {
    if (next === last.current) return;
    last.current = next;
    onChange(next);
    // This runs only from gesture/a11y event handlers, never while React renders.
    // eslint-disable-next-line react-hooks/purity
    const now = Date.now();
    // ROAD-02 M4: tests never produce device haptics. Runtime feedback is throttled during a drag.
    if (process.env.NODE_ENV !== 'test' && now - lastHapticAt.current >= 50) {
      lastHapticAt.current = now;
      onHaptic?.();
    }
  };

  // The responder callbacks read refs only after native gesture events; the useMemo factory itself does not.
  /* eslint-disable react-hooks/refs */
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_event, gesture) => Math.abs(gesture.dx) > 2,
        onPanResponderGrant: () => {
          start.current = quantity;
          last.current = quantity;
        },
        onPanResponderMove: (_event, gesture) => {
          const steps = Math.round(-gesture.dx / PIXELS_PER_STEP);
          emit(snapRulerQuantity(start.current + steps * step, serving));
        },
      }),
    // A new responder must capture the quantity/unit shown when the drag begins.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [quantity, serving.id, step, onHaptic],
  );
  /* eslint-enable react-hooks/refs */

  const isMajor = (value: number) => Math.abs(value / majorStep - Math.round(value / majorStep)) < 1e-7;
  return (
    <View style={{ gap: theme.spacing[2] }}>
      <FocusablePressable
        accessibilityRole="button"
        accessibilityLabel={t('servingRuler.editValue', { value: displayQuantity(quantity, locale) })}
        onPress={onOpenNumeric}
        testID="serving-ruler-value"
        style={{
          alignSelf: 'center',
          borderRadius: theme.radii.pill,
          backgroundColor: theme.colors.surfaceSubtle,
          paddingHorizontal: theme.spacing[4],
          paddingVertical: theme.spacing[2],
        }}
      >
        <AppText variant="sectionTitle" tabular>
          {displayQuantity(quantity, locale)}
        </AppText>
      </FocusablePressable>
      <View
        {...pan.panHandlers}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ min: step, now: quantity, text: label }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(event) => {
          const action = event.nativeEvent.actionName;
          if (action === 'increment' || action === 'decrement') {
            emit(adjustRulerQuantity(quantity, action, serving));
          }
        }}
        testID="serving-ruler"
        style={{
          height: 104,
          overflow: 'hidden',
          justifyContent: 'flex-end',
          backgroundColor: theme.colors.primary,
          borderRadius: theme.radii.medium,
          paddingHorizontal: theme.spacing[2],
        }}
      >
        <View style={{ flexDirection: 'row', flex: 1, alignItems: 'flex-end', justifyContent: 'space-between' }}>
          {TICK_OFFSETS.map((offset) => {
            const value = snapRulerQuantity(quantity + offset * step, serving);
            const major = isMajor(value);
            return (
              <View key={offset} style={{ width: 16, alignItems: 'center', justifyContent: 'flex-end' }}>
                {major ? (
                  <AppText
                    variant="label"
                    numberOfLines={1}
                    style={{
                      position: 'absolute',
                      bottom: 32,
                      left: -16,
                      width: 48,
                      color: theme.colors.onPrimary,
                    }}
                    tabular
                    align="center"
                  >
                    {displayQuantity(value, locale)}
                  </AppText>
                ) : null}
                <View style={{ width: 2, height: major ? 32 : 18, backgroundColor: theme.colors.onPrimary }} />
              </View>
            );
          })}
        </View>
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            alignSelf: 'center',
            bottom: 0,
            width: 3,
            height: 50,
            backgroundColor: theme.colors.onPrimary,
          }}
        />
      </View>
    </View>
  );
}
