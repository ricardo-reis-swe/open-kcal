import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Appearance, useColorScheme } from 'react-native';

import { darkTheme, lightTheme, type ColorScheme, type Theme, type ThemePreference } from './theme';

const ThemeContext = createContext<Theme>(lightTheme);
const SetPreferenceContext = createContext<(preference: ThemePreference) => void>(() => undefined);

type Props = {
  children: ReactNode;
  /** Forces a scheme (tests). Otherwise the UX-23 preference, where `system` follows the OS appearance. */
  scheme?: ColorScheme;
};

/** DS-03 / UX-23: light or dark tokens from the stored preference; `system` (the default) follows the OS. */
export function ThemeProvider({ children, scheme }: Props) {
  const system = useColorScheme();
  const [preference, setPreference] = useState<ThemePreference>('system');
  const resolved: ColorScheme =
    scheme ?? (preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference);
  return (
    <SetPreferenceContext.Provider value={setPreference}>
      <ThemeContext.Provider value={resolved === 'dark' ? darkTheme : lightTheme}>{children}</ThemeContext.Provider>
    </SetPreferenceContext.Provider>
  );
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}

/**
 * Applies the stored preference once it's known. The native override keeps system UI (keyboard, date picker,
 * alerts) on the same scheme as the app.
 */
export function useApplyThemePreference(preference: ThemePreference | undefined): void {
  const setPreference = useContext(SetPreferenceContext);
  useEffect(() => {
    if (!preference) return;
    setPreference(preference);
    Appearance.setColorScheme(preference === 'system' ? 'unspecified' : preference);
  }, [preference, setPreference]);
}
