import { createContext, useContext, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { darkTheme, lightTheme, type ColorScheme, type Theme } from './theme';

const ThemeContext = createContext<Theme>(lightTheme);

type Props = {
  children: ReactNode;
  /** Forces a scheme (tests, QA). Defaults to the OS appearance. */
  scheme?: ColorScheme;
};

export function ThemeProvider({ children, scheme }: Props) {
  const system = useColorScheme();
  const resolved: ColorScheme = scheme ?? (system === 'dark' ? 'dark' : 'light');
  return <ThemeContext.Provider value={resolved === 'dark' ? darkTheme : lightTheme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
