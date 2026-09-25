import { render, screen } from '@testing-library/react-native';
import { Text, useColorScheme } from 'react-native';

import { ThemeProvider, useTheme } from '..';
import { darkColors, lightColors } from '../tokens';

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: jest.fn(() => 'light'),
}));

const mockedUseColorScheme = useColorScheme as jest.MockedFunction<typeof useColorScheme>;

function Probe() {
  const theme = useTheme();
  return <Text>{`${theme.scheme}:${theme.colors.canvas}`}</Text>;
}

describe('DS-12: theme', () => {
  it('follows the OS light appearance', async () => {
    mockedUseColorScheme.mockReturnValue('light');
    await render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByText(`light:${lightColors.canvas}`)).toBeOnTheScreen();
  });

  it('follows the OS dark appearance', async () => {
    mockedUseColorScheme.mockReturnValue('dark');
    await render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByText(`dark:${darkColors.canvas}`)).toBeOnTheScreen();
  });

  it('lets a forced scheme override the OS', async () => {
    mockedUseColorScheme.mockReturnValue('light');
    await render(
      <ThemeProvider scheme="dark">
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByText(`dark:${darkColors.canvas}`)).toBeOnTheScreen();
  });

  it('light and dark palettes define the same semantic tokens', () => {
    expect(Object.keys(darkColors).sort()).toEqual(Object.keys(lightColors).sort());
  });
});
