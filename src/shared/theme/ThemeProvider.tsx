import { createContext, useContext, type ReactNode } from 'react';

import { lightTheme, type Theme } from './theme';

const ThemeContext = createContext<Theme>(lightTheme);

type Props = {
  children: ReactNode;
};

/** The MVP is light-only; dark tokens remain available for a future theme setting. */
export function ThemeProvider({ children }: Props) {
  return <ThemeContext.Provider value={lightTheme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
