import { render, screen } from '@testing-library/react-native';
import { Appearance, Text, useColorScheme } from 'react-native';

import { ThemeProvider, useApplyThemePreference, useTheme, type ThemePreference } from '..';
import { darkColors, lightColors } from '../tokens';

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: jest.fn(() => 'light'),
}));

const mockedUseColorScheme = useColorScheme as jest.MockedFunction<typeof useColorScheme>;

function Probe({ preference }: { preference?: ThemePreference }) {
  useApplyThemePreference(preference);
  const theme = useTheme();
  return <Text>{`${theme.scheme}:${theme.colors.canvas}`}</Text>;
}

const renderProbe = (preference?: ThemePreference) =>
  render(
    <ThemeProvider>
      <Probe preference={preference} />
    </ThemeProvider>,
  );

describe('DS-12 / UX-23: theme', () => {
  let setColorScheme: jest.SpyInstance;
  beforeEach(() => {
    setColorScheme = jest.spyOn(Appearance, 'setColorScheme').mockImplementation(() => undefined);
  });
  afterEach(() => setColorScheme.mockRestore());

  it('follows the OS appearance before a preference is known and for `system`', async () => {
    mockedUseColorScheme.mockReturnValue('dark');
    await renderProbe();
    expect(screen.getByText(`dark:${darkColors.canvas}`)).toBeOnTheScreen();
    expect(setColorScheme).not.toHaveBeenCalled();

    mockedUseColorScheme.mockReturnValue('light');
    await renderProbe('system');
    expect(screen.getByText(`light:${lightColors.canvas}`)).toBeOnTheScreen();
    expect(setColorScheme).toHaveBeenCalledWith('unspecified');
  });

  it('a light or dark preference overrides the OS and the native appearance', async () => {
    mockedUseColorScheme.mockReturnValue('light');
    await renderProbe('dark');
    expect(screen.getByText(`dark:${darkColors.canvas}`)).toBeOnTheScreen();
    expect(setColorScheme).toHaveBeenLastCalledWith('dark');

    mockedUseColorScheme.mockReturnValue('dark');
    await renderProbe('light');
    expect(screen.getByText(`light:${lightColors.canvas}`)).toBeOnTheScreen();
    expect(setColorScheme).toHaveBeenLastCalledWith('light');
  });

  it('lets a forced scheme override everything (tests)', async () => {
    mockedUseColorScheme.mockReturnValue('light');
    await render(
      <ThemeProvider scheme="dark">
        <Probe preference="light" />
      </ThemeProvider>,
    );
    expect(screen.getByText(`dark:${darkColors.canvas}`)).toBeOnTheScreen();
  });

  it('light and dark palettes define the same semantic tokens', () => {
    expect(Object.keys(darkColors).sort()).toEqual(Object.keys(lightColors).sort());
  });
});
