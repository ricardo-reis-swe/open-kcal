import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { ThemeProvider, useTheme } from '..';
import { darkColors, lightColors } from '../tokens';

function Probe() {
  const theme = useTheme();
  return <Text>{`${theme.scheme}:${theme.colors.canvas}`}</Text>;
}

describe('DS-12: theme', () => {
  it('uses the light theme', async () => {
    await render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByText(`light:${lightColors.canvas}`)).toBeOnTheScreen();
  });

  it('keeps a future dark palette with the same semantic tokens', () => {
    expect(Object.keys(darkColors).sort()).toEqual(Object.keys(lightColors).sort());
  });
});
