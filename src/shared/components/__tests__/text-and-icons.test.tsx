import { screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { renderWithProviders } from '@/shared/testing/render';
import { darkColors, lightColors, typography } from '@/shared/theme/tokens';

import { AppIcon, AppText, SectionHeader } from '..';

describe('DS-12: AppText', () => {
  it('DS-04: applies the token type scale and semantic color', async () => {
    await renderWithProviders(
      <AppText variant="compact" color="textSecondary">
        2 × egg
      </AppText>,
    );
    const style = StyleSheet.flatten(screen.getByText('2 × egg').props.style);
    expect(style).toMatchObject({
      fontSize: typography.compact.fontSize,
      lineHeight: typography.compact.lineHeight,
      color: lightColors.textSecondary,
    });
  });

  it('DS-04: uses tabular figures for numbers', async () => {
    await renderWithProviders(<AppText tabular>1,731</AppText>);
    expect(StyleSheet.flatten(screen.getByText('1,731').props.style).fontVariant).toEqual(['tabular-nums']);
  });

  it('DS-11: always scales with the OS text size', async () => {
    await renderWithProviders(<AppText>Diary</AppText>);
    expect(screen.getByText('Diary').props.allowFontScaling).toBe(true);
    expect(screen.getByText('Diary').props.maxFontSizeMultiplier).toBeUndefined();
  });

  it('DS-03: switches to dark tokens in dark mode', async () => {
    await renderWithProviders(<AppText>Diary</AppText>, { scheme: 'dark' });
    expect(StyleSheet.flatten(screen.getByText('Diary').props.style).color).toBe(darkColors.textPrimary);
  });
});

describe('DS-12: AppIcon', () => {
  it('DS-06: is hidden from screen readers', async () => {
    await renderWithProviders(<AppIcon name="add" testID="icon" />);
    const icon = screen.getByTestId('icon', { includeHiddenElements: true });
    expect(icon).not.toBeVisible();
  });
});

describe('DS-12: SectionHeader', () => {
  it('DS-09: renders a header-role label, uppercase only when asked', async () => {
    await renderWithProviders(<SectionHeader label="Recent" uppercase />);
    const header = screen.getByRole('header', { name: 'Recent' });
    expect(StyleSheet.flatten(header.props.style).textTransform).toBe('uppercase');
  });
});
