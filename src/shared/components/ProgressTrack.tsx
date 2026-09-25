import { View } from 'react-native';

import { useTheme, type Colors } from '@/shared/theme';

export type ProgressTrackProps = {
  /** 0..1; values outside are clamped. Over-goal meaning is stated in text by the parent (DS-03). */
  progress: number;
  color?: keyof Colors;
  testID?: string;
};

/** 4pt progress track (DS-08 macro strip). Decorative: the parent's label carries the numbers (DS-11). */
export function ProgressTrack({ progress, color = 'primary', testID }: ProgressTrackProps) {
  const theme = useTheme();
  const clamped = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0;
  const height = theme.sizes.macroTrack;
  return (
    <View
      testID={testID}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={{ height, borderRadius: height / 2, backgroundColor: theme.colors.divider, overflow: 'hidden' }}
    >
      <View
        testID={testID ? `${testID}-fill` : undefined}
        style={{ width: `${clamped * 100}%`, height, borderRadius: height / 2, backgroundColor: theme.colors[color] }}
      />
    </View>
  );
}
