import { LegendList, type LegendListRef } from '@legendapp/list';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, type NativeScrollEvent, type NativeSyntheticEvent, useWindowDimensions, View } from 'react-native';

import type { FoodServing } from '@/data/db/repositories/foodsRepository';
import { adjustRulerQuantity, rulerSpec, snapRulerQuantity } from '@/domain/food/servings';
import type { EnergyUnit } from '@/domain/units/units';
import { AppText } from '@/shared/components';
import { FocusablePressable } from '@/shared/components/FocusablePressable';
import { formatEnergy } from '@/shared/i18n/format';
import { useFormattingLocale } from '@/shared/i18n/useFormattingLocale';
import { useTheme } from '@/shared/theme';

const STEP_WIDTH = 2;
const STEP_GAP = 16;
const STEP_SIZE = STEP_WIDTH + STEP_GAP;
const MINIMUM_STEPS = 2_000;

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

/** Changes value only when the next tick crosses the fixed pointer, rather than halfway between ticks. */
export function rulerIndexForOffset(offset: number, previousOffset: number, maximumIndex: number): number {
  const rawIndex = Math.max(0, offset) / STEP_SIZE;
  const index = offset >= previousOffset ? Math.floor(rawIndex + 1e-7) : Math.ceil(rawIndex - 1e-7);
  return Math.max(0, Math.min(maximumIndex, index));
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

/** DS-09 / UX-05: native-momentum serving ruler with a fixed pointer and accessible alternatives. */
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
  const listRef = useRef<LegendListRef>(null);
  const last = useRef(quantity);
  const lastOffset = useRef(0);
  const scrolling = useRef(false);
  const scrollEndTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastHapticAt = useRef(0);
  const { step, majorStep } = rulerSpec(serving);
  const minimum = step;
  const initialIndex = Math.max(0, Math.round((quantity - minimum) / step));
  const maximumIndex = Math.max(MINIMUM_STEPS, initialIndex + 1_000);
  const data = useMemo(() => Array.from({ length: maximumIndex + 1 }, (_, index) => index), [maximumIndex]);
  const rulerWidth = Math.max(1, windowWidth - theme.spacing[8]);
  const energy = formatEnergy(energyKcal, energyUnit, locale);
  const spokenUnit = t(`diary.units.${energyUnit}Spoken`);
  const label = t('servingRuler.a11y', {
    quantity: displayQuantity(quantity, locale),
    serving: serving.label,
    energy,
    unit: spokenUnit,
  });

  const offsetForQuantity = useCallback(
    (value: number) => Math.max(0, Math.round((value - minimum) / step)) * STEP_SIZE,
    [minimum, step],
  );

  const scrollToQuantity = useCallback(
    (value: number, animated: boolean) => {
      const offset = offsetForQuantity(value);
      lastOffset.current = offset;
      listRef.current?.scrollToOffset({ offset, animated });
    },
    [offsetForQuantity],
  );

  useEffect(() => {
    last.current = quantity;
    if (!scrolling.current) scrollToQuantity(quantity, false);
  }, [quantity, scrollToQuantity]);

  useEffect(
    () => () => {
      if (scrollEndTimer.current) clearTimeout(scrollEndTimer.current);
    },
    [],
  );

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

  const valueAtOffset = useCallback(
    (offset: number) => {
      const index = rulerIndexForOffset(offset, lastOffset.current, maximumIndex);
      lastOffset.current = offset;
      return snapRulerQuantity(minimum + index * step, serving);
    },
    [maximumIndex, minimum, serving, step],
  );

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      emit(valueAtOffset(event.nativeEvent.contentOffset.x));
    },
    [emit, valueAtOffset],
  );

  const settle = useCallback(
    (offset: number) => {
      const index = Math.max(0, Math.min(maximumIndex, Math.round(offset / STEP_SIZE)));
      lastOffset.current = index * STEP_SIZE;
      emit(snapRulerQuantity(minimum + index * step, serving));
      scrolling.current = false;
    },
    [emit, maximumIndex, minimum, serving, step],
  );

  const sidePadding = <View style={{ width: rulerWidth / 2 - STEP_WIDTH / 2 }} />;
  const isMajor = (value: number) => Math.abs(value / majorStep - Math.round(value / majorStep)) < 1e-7;

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
          if (action === 'increment' || action === 'decrement') {
            const next = adjustRulerQuantity(quantity, action, serving);
            emit(next);
            scrollToQuantity(next, true);
          }
        }}
        testID="serving-ruler"
        style={{ height: 80, overflow: 'hidden', backgroundColor: theme.colors.primary }}
      >
        <LegendList
          key={serving.id}
          testID="serving-ruler-list"
          ref={listRef}
          data={data}
          horizontal
          recycleItems
          estimatedItemSize={STEP_SIZE}
          getFixedItemSize={() => STEP_SIZE}
          drawDistance={rulerWidth}
          keyExtractor={(index) => String(index)}
          ListHeaderComponent={sidePadding}
          ListFooterComponent={sidePadding}
          renderItem={({ item: index }) => {
            const value = snapRulerQuantity(minimum + index * step, serving);
            const major = isMajor(value);
            return (
              <View style={{ width: STEP_WIDTH, height: 80, marginRight: STEP_GAP, alignItems: 'center' }}>
                <View
                  style={{
                    width: STEP_WIDTH,
                    height: major ? 35 : 12,
                    backgroundColor: theme.colors.onPrimary,
                  }}
                />
                {major ? (
                  <AppText
                    variant="body"
                    numberOfLines={1}
                    tabular
                    align="center"
                    style={{
                      position: 'absolute',
                      top: 44,
                      left: -23,
                      width: 48,
                      color: theme.colors.onPrimary,
                    }}
                  >
                    {displayQuantity(value, locale)}
                  </AppText>
                ) : null}
              </View>
            );
          }}
          onScrollBeginDrag={() => {
            if (scrollEndTimer.current) clearTimeout(scrollEndTimer.current);
            scrolling.current = true;
          }}
          onMomentumScrollBegin={() => {
            if (scrollEndTimer.current) clearTimeout(scrollEndTimer.current);
            scrolling.current = true;
          }}
          onScroll={handleScroll}
          onScrollEndDrag={(event) => {
            const offset = event.nativeEvent.contentOffset.x;
            if (scrollEndTimer.current) clearTimeout(scrollEndTimer.current);
            scrollEndTimer.current = setTimeout(() => settle(offset), 150);
          }}
          onMomentumScrollEnd={(event) => {
            if (scrollEndTimer.current) clearTimeout(scrollEndTimer.current);
            settle(event.nativeEvent.contentOffset.x);
          }}
          onContentSizeChange={() => scrollToQuantity(quantity, false)}
          snapToInterval={STEP_SIZE}
          snapToAlignment="start"
          decelerationRate="fast"
          scrollEventThrottle={16}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
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
