import { createContext, forwardRef, useContext, useState } from 'react';
import { Pressable, type PressableProps, type View } from 'react-native';

import { useTheme, type Colors } from '@/shared/theme';

/** Ring color for pressables inside a colored container, e.g. `onAppBar` in the app bar (DS-11 ≥3:1). */
export const FocusRingColorContext = createContext<keyof Colors>('focus');

/**
 * Pressable that shows the DS-10 focus ring (2px `focus` outline) for hardware keyboard / switch access.
 * An outline draws outside the box, so focusing never shifts layout. Every pressable primitive uses it (DS-12).
 */
export const FocusablePressable = forwardRef<View, PressableProps>(function FocusablePressable(
  { style, onFocus, onBlur, ...props },
  ref,
) {
  const theme = useTheme();
  const ringColor = useContext(FocusRingColorContext);
  const [focused, setFocused] = useState(false);
  const ring = focused
    ? { outlineWidth: theme.sizes.focusRing, outlineColor: theme.colors[ringColor], outlineStyle: 'solid' as const }
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
