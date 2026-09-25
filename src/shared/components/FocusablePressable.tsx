import { forwardRef, useState } from 'react';
import { Pressable, type PressableProps, type View } from 'react-native';

import { useTheme } from '@/shared/theme';

/**
 * Pressable that shows the DS-10 focus ring (2px `focus` outline) for hardware keyboard / switch access.
 * An outline draws outside the box, so focusing never shifts layout. Every pressable primitive uses it (DS-12).
 */
export const FocusablePressable = forwardRef<View, PressableProps>(function FocusablePressable(
  { style, onFocus, onBlur, ...props },
  ref,
) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const ring = focused
    ? { outlineWidth: theme.sizes.focusRing, outlineColor: theme.colors.focus, outlineStyle: 'solid' as const }
    : null;
  return (
    <Pressable
      ref={ref}
      {...props}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        onBlur?.(e);
      }}
      style={(state) => [typeof style === 'function' ? style(state) : style, ring]}
    />
  );
});
