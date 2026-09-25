import { useTranslation } from 'react-i18next';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import type { EnergyUnit } from '@/domain/units/units';
import { AppText } from '@/shared/components';
import { formatEnergy } from '@/shared/i18n/format';
import { useFormattingLocale } from '@/shared/i18n/useFormattingLocale';
import { useTheme, type Colors } from '@/shared/theme';

export type CalorieRingProps = {
  eatenKcal: number;
  /** `null` when no goal applies to the date yet (before the first goal's `effective_from`, DATA-09). */
  goalKcal: number | null;
  unit: EnergyUnit;
};

/**
 * DS-08 calorie ring: remaining value, unit-aware `kcal left`, consumed below. Over goal → the amount over,
 * `kcal over` and the warning color, never an unexplained red ring (DS-03). One screen-reader element (UX-02).
 */
export function CalorieRing({ eatenKcal, goalKcal, unit }: CalorieRingProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const locale = useFormattingLocale();
  const { fontScale, width } = useWindowDimensions();
  // DS-11: text scales, so the ring grows with it (up to the screen width) instead of clipping its content.
  // Shrink-to-fit only at large sizes; at default text the content always fits the 140 ring.
  const large = fontScale >= 1.5;
  // DS-08 ring: the smallest token diameter (136) protects Diary density (DS-02); the thicker token stroke.
  const baseDiameter = theme.sizes.calorieRing.diameter[0];
  const stroke = theme.sizes.calorieRing.stroke[1];
  const diameter = Math.round(Math.min(baseDiameter * Math.max(fontScale, 1), width - 2 * theme.spacing[4]));
  const unitLabel = t(`diary.units.${unit}`);
  const unitSpoken = t(`diary.units.${unit}Spoken`);
  const fmt = (kcal: number) => formatEnergy(kcal, unit, locale);
  const eaten = fmt(eatenKcal);

  let value: string;
  let caption: string;
  let detail: string | null;
  let a11y: string;
  let tone: keyof Colors = 'textPrimary';
  let progress = 0;
  let ringColor: keyof Colors = 'primary';
  if (goalKcal === null) {
    value = eaten;
    caption = t('diary.ring.eatenNoGoal', { unit: unitLabel });
    detail = t('diary.ring.noGoal');
    a11y = t('diary.ring.a11yNoGoal', { eaten, unit: unitSpoken });
  } else if (eatenKcal > goalKcal) {
    const over = fmt(eatenKcal - goalKcal);
    value = over;
    caption = t('diary.ring.over', { unit: unitLabel });
    detail = t('diary.ring.eaten', { value: eaten });
    a11y = t('diary.ring.a11yOver', { over, goal: fmt(goalKcal), eaten, unit: unitSpoken });
    tone = 'warning';
    ringColor = 'warning';
    progress = 1;
  } else {
    const remaining = fmt(goalKcal - eatenKcal);
    value = remaining;
    caption = t('diary.ring.left', { unit: unitLabel });
    detail = t('diary.ring.eaten', { value: eaten });
    a11y = t('diary.ring.a11yLeft', { remaining, goal: fmt(goalKcal), eaten, unit: unitSpoken });
    progress = goalKcal > 0 ? eatenKcal / goalKcal : 0;
  }

  return (
    <View
      testID="calorie-ring"
      accessible
      accessibilityRole="text"
      accessibilityLabel={a11y}
      style={{ width: diameter, height: diameter }}
    >
      <RingArc
        diameter={diameter}
        stroke={stroke}
        progress={progress}
        color={theme.colors[ringColor]}
        track={theme.colors.divider}
      />
      <View
        style={[
          StyleSheet.absoluteFill,
          styles.center,
          { padding: large ? diameter * 0.15 + stroke : stroke + theme.spacing[1] },
        ]}
      >
        <AppText variant="displayNumber" tabular color={tone} numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </AppText>
        <AppText
          variant="compact"
          color={tone === 'warning' ? 'warning' : 'textSecondary'}
          align="center"
          numberOfLines={1}
          adjustsFontSizeToFit={large}
        >
          {caption}
        </AppText>
        {detail ? (
          <AppText
            variant="compact"
            color="textSecondary"
            tabular
            align="center"
            numberOfLines={1}
            adjustsFontSizeToFit={large}
          >
            {detail}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

/**
 * Progress arc drawn with two clipped half-rings (no SVG dependency): the right half covers 0–50 %, the left half
 * 50–100 %, and two dots make the round caps (DS-08). Decorative: the ring's label carries the numbers.
 */
function RingArc({
  diameter,
  stroke,
  progress,
  color,
  track,
}: {
  diameter: number;
  stroke: number;
  progress: number;
  color: string;
  track: string;
}) {
  const p = Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0));
  const half = diameter / 2;
  const ring = { width: diameter, height: diameter, borderRadius: half, borderWidth: stroke, borderColor: color };
  const rightDeg = Math.min(p, 0.5) * 360;
  const leftDeg = Math.max(p - 0.5, 0) * 360;
  const cap = (deg: number) => {
    const rad = (deg * Math.PI) / 180;
    const r = half - stroke / 2;
    return {
      position: 'absolute' as const,
      width: stroke,
      height: stroke,
      borderRadius: stroke / 2,
      backgroundColor: color,
      left: half + r * Math.sin(rad) - stroke / 2,
      top: half - r * Math.cos(rad) - stroke / 2,
    };
  };
  return (
    <View
      testID="calorie-ring-arc"
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={StyleSheet.absoluteFill}
    >
      <View style={[StyleSheet.absoluteFill, { borderRadius: half, borderWidth: stroke, borderColor: track }]} />
      {p > 0 ? (
        <>
          <View style={[styles.clip, { left: half, width: half, height: diameter }]}>
            <View
              style={[
                styles.clip,
                { left: -half, width: half, height: diameter, transformOrigin: 'right center' },
                { transform: [{ rotate: `${rightDeg}deg` }] },
              ]}
            >
              <View style={ring} />
            </View>
          </View>
          {leftDeg > 0 ? (
            <View style={[styles.clip, { left: 0, width: half, height: diameter }]}>
              <View
                style={[
                  styles.clip,
                  { left: half, width: half, height: diameter, transformOrigin: 'left center' },
                  { transform: [{ rotate: `${leftDeg}deg` }] },
                ]}
              >
                <View style={[ring, { marginLeft: -half }]} />
              </View>
            </View>
          ) : null}
          <View style={cap(0)} />
          <View style={cap(p * 360)} />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  clip: { position: 'absolute', top: 0, overflow: 'hidden' },
});
