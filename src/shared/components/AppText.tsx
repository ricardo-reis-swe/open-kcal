import { Text, useWindowDimensions, type TextProps, type TextStyle } from 'react-native';

import { useTheme, type Colors } from '@/shared/theme';
import type { typography } from '@/shared/theme/tokens';

export type TextVariant = keyof typeof typography;

export type AppTextProps = TextProps & {
  variant?: TextVariant;
  color?: keyof Colors;
  /** Tabular figures for kcal, macros, weight, progress and ruler values (DS-04). */
  tabular?: boolean;
  align?: TextStyle['textAlign'];
};

/** All app text. System font, token type scale, always scales with the OS text size (DS-04, DS-11). */
export function AppText({
  variant = 'body',
  color = 'textPrimary',
  tabular = false,
  align,
  style,
  ...rest
}: AppTextProps) {
  const theme = useTheme();
  const type = theme.typography[variant];
  // A live OS text-size change doesn't re-measure text whose props didn't change (seen on iOS 27: the app bar
  // title stayed clipped). Keying on the font scale remounts the node so it lays out at the new size (DS-11).
  const { fontScale } = useWindowDimensions();
  return (
    <Text
      key={fontScale}
      {...rest}
      allowFontScaling
      style={[
        {
          fontSize: type.fontSize,
          lineHeight: type.lineHeight,
          fontWeight: type.fontWeight,
          color: theme.colors[color],
        },
        tabular && { fontVariant: ['tabular-nums'] },
        align !== undefined && { textAlign: align },
        style,
      ]}
    />
  );
}
