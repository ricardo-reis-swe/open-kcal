// DS-14 widget layout. Widget primitives only (RemoteViews): no theme hooks, colors and type straight from tokens.
import { FlexWidget, TextWidget } from 'react-native-android-widget';

import { lightColors, radii, spacing, typography } from '@/shared/theme/tokens';

import type { CaloriesLeftView } from './caloriesLeftViewModel';

/** NAV-10: every tap opens the Diary on today. */
export const WIDGET_URI = 'calorietracker://diary/today';

type Hex = `#${string}`;
const color = (hex: string) => hex as Hex;

export function CaloriesLeftWidget({ view }: { view: CaloriesLeftView }) {
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: WIDGET_URI }}
      accessibilityLabel={view.a11y}
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: color(lightColors.surface),
        borderRadius: radii.large,
        padding: spacing[3],
        justifyContent: 'center',
        alignItems: 'flex-start',
      }}
    >
      {view.kind !== 'unavailable' ? (
        <TextWidget
          text={view.value}
          maxLines={1}
          style={{
            fontSize: typography.displayNumber.fontSize,
            fontWeight: typography.displayNumber.fontWeight,
            color: color(view.kind === 'over' ? lightColors.warning : lightColors.textPrimary),
          }}
        />
      ) : null}
      <TextWidget
        text={view.label}
        maxLines={1}
        truncate="END"
        style={{
          fontSize: typography.compact.fontSize,
          fontWeight: typography.compact.fontWeight,
          color: color(lightColors.textSecondary),
        }}
      />
    </FlexWidget>
  );
}
