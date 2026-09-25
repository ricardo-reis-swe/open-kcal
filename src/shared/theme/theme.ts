import { Platform, type ViewStyle } from 'react-native';

import { darkColors, lightColors, motionMs, radii, sizes, spacing, typography, type ThemeColors } from './tokens';

// Theme assembled from `tokens.ts` (DS-12). Components read it via `useTheme()`, never tokens directly.

export type ColorScheme = 'light' | 'dark';
export type Elevation = 0 | 1 | 2;

/** Semantic tokens plus content colors derived for filled surfaces. */
export type Colors = ThemeColors & {
  /** Text/icons on a filled `primary` control (white in light; dark text on the bright dark-mode green). */
  onPrimary: string;
  /** Text/icons on the app bar (DS-07: high-contrast on the light green bar, normal text on the dark surface bar). */
  onAppBar: string;
};

export type Theme = {
  scheme: ColorScheme;
  colors: Colors;
  typography: typeof typography;
  spacing: typeof spacing;
  radii: typeof radii;
  sizes: typeof sizes;
  motionMs: typeof motionMs;
  /** Minimum hit area for the current platform (DS-02). */
  touchMin: number;
  /** DS-05: one shadow style; 0 surfaces/rows, 1 sticky nav + center action, 2 sheets/menus/dialogs. */
  elevation: (level: Elevation) => ViewStyle;
};

const SHADOW_COLOR = '#000000';
const ON_GREEN_LIGHT = '#FFFFFF'; // DS-03: white only on greens that pass contrast (tested)

function elevationFor(scheme: ColorScheme, colors: Colors) {
  return (level: Elevation): ViewStyle => {
    if (level === 0) return {};
    // Dark mode relies on contrast + borders, not heavier shadows (DS-03, DS-05).
    if (scheme === 'dark') return { borderWidth: 1, borderColor: colors.divider };
    return Platform.select<ViewStyle>({
      android: { elevation: level === 1 ? 3 : 8 },
      default: {
        shadowColor: SHADOW_COLOR,
        shadowOpacity: level === 1 ? 0.12 : 0.18,
        shadowRadius: level === 1 ? 4 : 12,
        shadowOffset: { width: 0, height: level === 1 ? 1 : 4 },
      },
    });
  };
}

export function createTheme(scheme: ColorScheme): Theme {
  const base: ThemeColors = scheme === 'dark' ? darkColors : lightColors;
  const colors: Colors = {
    ...base,
    onPrimary: scheme === 'dark' ? base.canvas : ON_GREEN_LIGHT,
    onAppBar: scheme === 'dark' ? base.textPrimary : ON_GREEN_LIGHT,
  };
  return {
    scheme,
    colors,
    typography,
    spacing,
    radii,
    sizes,
    motionMs,
    touchMin: Platform.OS === 'ios' ? sizes.touchMin.ios : sizes.touchMin.android,
    elevation: elevationFor(scheme, colors),
  };
}

export const lightTheme = createTheme('light');
export const darkTheme = createTheme('dark');
