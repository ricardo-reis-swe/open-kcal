// DS-14 widget layout. Widget primitives only (RemoteViews): no theme hooks, colors and type straight from tokens.
import { FlexWidget, TextWidget, type WidgetRepresentation } from 'react-native-android-widget';

import type { ColorScheme, ThemePreference } from '@/shared/theme/theme';
import { darkColors, lightColors, radii, spacing, typography } from '@/shared/theme/tokens';

import type { CaloriesLeftView } from './caloriesLeftViewModel';

/** NAV-10: every tap opens the Diary on today. */
export const WIDGET_URI = 'calorietracker://diary/today';

type Hex = `#${string}`;
const color = (hex: string) => hex as Hex;

export function CaloriesLeftWidget({ view, scheme }: { view: CaloriesLeftView; scheme: ColorScheme }) {
  const colors = scheme === 'dark' ? darkColors : lightColors;
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: WIDGET_URI }}
      accessibilityLabel={view.a11y}
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: color(colors.surface),
        borderRadius: radii.large,
        padding: spacing[3],
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      {view.kind !== 'unavailable' ? (
        <TextWidget
          text={view.value}
          maxLines={1}
          style={{
            fontSize: typography.displayNumber.fontSize,
            fontWeight: typography.displayNumber.fontWeight,
            color: color(view.kind === 'over' ? colors.warning : colors.textPrimary),
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
          color: color(colors.textSecondary),
        }}
      />
    </FlexWidget>
  );
}

/**
 * DS-14 / UX-23: `system` hands the launcher both versions, so the widget switches with the phone's dark mode without
 * a redraw. A forced Light or Dark draws only that one.
 */
export function renderCaloriesLeftWidget(view: CaloriesLeftView, preference: ThemePreference): WidgetRepresentation {
  if (preference !== 'system') return <CaloriesLeftWidget view={view} scheme={preference} />;
  return {
    light: <CaloriesLeftWidget view={view} scheme="light" />,
    dark: <CaloriesLeftWidget view={view} scheme="dark" />,
  };
}
