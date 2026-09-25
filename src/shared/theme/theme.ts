import { Platform, type ViewStyle } from 'react-native';

import { darkColors, lightColors, motionMs, radii, sizes, spacing, typography, type ThemeColors } from './tokens';

// Theme assembled from `tokens.ts` (DS-12). Components read it via `useTheme()`, never tokens directly.

export type ColorScheme = 'light' | 'dark';
export type Elevation = 0 | 1 | 2;

export type Theme = {
  scheme: ColorScheme;
  colors: ThemeColors;
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

function elevationFor(scheme: ColorScheme, colors: ThemeColors) {
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
  const colors = scheme === 'dark' ? darkColors : lightColors;
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
