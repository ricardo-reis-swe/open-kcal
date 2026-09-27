import { fireEvent, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { i18next } from '@/shared/i18n/i18n';
import { renderWithProviders } from '@/shared/testing/render';
import { lightColors } from '@/shared/theme/tokens';

import { AppBar, ListRow, PressableIcon, PrimaryButton, TextAction } from '..';

describe('DS-12: PrimaryButton', () => {
  it('DS-09: is a labelled button that calls onPress', async () => {
    const onPress = jest.fn();
    await renderWithProviders(<PrimaryButton label="Add" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Add' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('DS-10: disabled blocks presses and keeps readable text', async () => {
    const onPress = jest.fn();
    await renderWithProviders(<PrimaryButton label="Save" onPress={onPress} disabled />);
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toBeDisabled();
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
    expect(StyleSheet.flatten(screen.getByText('Save').props.style).color).toBe(lightColors.textSecondary);
  });

  it('DS-10: loading is busy and blocks presses', async () => {
    const onPress = jest.fn();
    await renderWithProviders(<PrimaryButton label="Save" onPress={onPress} loading />);
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toBeBusy();
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('DS-10: the spinner stays visible on the disabled fill', async () => {
    await renderWithProviders(<PrimaryButton label="Save" onPress={jest.fn()} loading />);
    expect(screen.getByTestId('primary-button-spinner').props.color).toBe('#FFFFFF');
    await renderWithProviders(<PrimaryButton label="Save" onPress={jest.fn()} loading disabled />);
    expect(screen.getByTestId('primary-button-spinner').props.color).toBe(lightColors.textSecondary);
  });

  it('DS-03: uses high-contrast content on the light primary fill', async () => {
    await renderWithProviders(<PrimaryButton label="Add" onPress={jest.fn()} />);
    expect(StyleSheet.flatten(screen.getByText('Add').props.style).color).toBe('#FFFFFF');
  });
});

describe('DS-12: TextAction', () => {
  it('DS-09: tertiary text action with a full touch target', async () => {
    const onPress = jest.fn();
    await renderWithProviders(<TextAction label="Add food" icon="add" onPress={onPress} />);
    const action = screen.getByRole('button', { name: 'Add food' });
    await fireEvent.press(action);
    expect(onPress).toHaveBeenCalled();
    expect(StyleSheet.flatten(action.props.style).minHeight).toBeGreaterThanOrEqual(44);
  });

  it('UX-00: danger tone for destructive text actions', async () => {
    await renderWithProviders(<TextAction label="Delete entry" tone="danger" onPress={jest.fn()} />);
    expect(StyleSheet.flatten(screen.getByText('Delete entry').props.style).color).toBe(lightColors.danger);
  });
});

describe('DS-12: PressableIcon', () => {
  it('DS-06: icon-only action exposes its label and reaches the touch minimum', async () => {
    const onPress = jest.fn();
    await renderWithProviders(
      <PressableIcon icon="calendar-outline" accessibilityLabel="Choose date" onPress={onPress} />,
    );
    const button = screen.getByRole('button', { name: 'Choose date' });
    await fireEvent.press(button);
    expect(onPress).toHaveBeenCalled();
    const style = StyleSheet.flatten(button.props.style);
    expect(style.minWidth).toBeGreaterThanOrEqual(44);
    expect(style.minHeight).toBeGreaterThanOrEqual(44);
  });

  it('DS-10: disabled blocks presses', async () => {
    const onPress = jest.fn();
    await renderWithProviders(<PressableIcon icon="add" accessibilityLabel="Add" onPress={onPress} disabled />);
    await fireEvent.press(screen.getByRole('button', { name: 'Add' }));
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('DS-12: ListRow', () => {
  it('DS-11: one coherent label with the current value; chevron only when it navigates', async () => {
    const onPress = jest.fn();
    await renderWithProviders(<ListRow label="Units" value="kg" onPress={onPress} navigates />);
    await fireEvent.press(screen.getByRole('button', { name: 'Units, kg' }));
    expect(onPress).toHaveBeenCalled();
  });

  it('ARCH-22: joins label and value through the localized a11y.labelWithValue pattern', async () => {
    const original = i18next.t('a11y.labelWithValue');
    i18next.addResource('en', 'translation', 'a11y.labelWithValue', '{{value}} · {{label}}');
    try {
      await renderWithProviders(<ListRow label="Units" value="kg" onPress={jest.fn()} />);
      expect(screen.getByRole('button', { name: 'kg · Units' })).toBeOnTheScreen();
    } finally {
      i18next.addResource('en', 'translation', 'a11y.labelWithValue', original);
    }
  });

  it('renders a non-interactive row without a button role', async () => {
    await renderWithProviders(<ListRow label="Open Food Facts" value="Always on" />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByLabelText('Open Food Facts, Always on')).toBeOnTheScreen();
  });

  it('DS-10: a disabled row blocks presses and has less emphasis', async () => {
    const onPress = jest.fn();
    await renderWithProviders(<ListRow label="Meals" onPress={onPress} disabled />);
    const row = screen.getByRole('button', { name: 'Meals' });
    expect(row).toBeDisabled();
    await fireEvent.press(row);
    expect(onPress).not.toHaveBeenCalled();
    expect(StyleSheet.flatten(screen.getByText('Meals').props.style).color).toBe(lightColors.textSecondary);
  });

  it('DS-09: rows are at least 48 high', async () => {
    await renderWithProviders(<ListRow label="Meals" onPress={jest.fn()} navigates />);
    expect(
      StyleSheet.flatten(screen.getByRole('button', { name: 'Meals' }).props.style).minHeight,
    ).toBeGreaterThanOrEqual(48);
  });
});

describe('DS-10: focus ring on pressable primitives', () => {
  it.each([
    ['PrimaryButton', <PrimaryButton key="p" label="Target" onPress={jest.fn()} />],
    ['TextAction', <TextAction key="t" label="Target" onPress={jest.fn()} />],
    ['PressableIcon', <PressableIcon key="i" icon="add" accessibilityLabel="Target" onPress={jest.fn()} />],
    ['ListRow', <ListRow key="l" label="Target" onPress={jest.fn()} />],
  ])('%s shows a 2px focus outline only while focused', async (_name, ui) => {
    await renderWithProviders(ui);
    const target = () => screen.getByRole('button', { name: 'Target' });
    expect(StyleSheet.flatten(target().props.style).outlineWidth).toBeUndefined();
    await fireEvent(target(), 'focus');
    expect(StyleSheet.flatten(target().props.style)).toMatchObject({
      outlineWidth: 2,
      outlineColor: lightColors.focus,
    });
    await fireEvent(target(), 'blur');
    expect(StyleSheet.flatten(target().props.style).outlineWidth).toBeUndefined();
  });

  it('uses the app bar content color for the ring inside AppBar (M0-Q1)', async () => {
    await renderWithProviders(<AppBar title="Meal" back={{ label: 'Back', onPress: jest.fn() }} />);
    const back = screen.getByRole('button', { name: 'Back' });
    await fireEvent(back, 'focus');
    expect(StyleSheet.flatten(screen.getByRole('button', { name: 'Back' }).props.style).outlineColor).toBe('#FFFFFF');
  });
});
