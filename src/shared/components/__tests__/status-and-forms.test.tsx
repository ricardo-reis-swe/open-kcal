import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/shared/testing/render';

import { FormField, InlineStatus, ProgressTrack } from '..';

describe('DS-12: FormField', () => {
  it('DS-09: labels the input, including the adjacent unit', async () => {
    await renderWithProviders(<FormField label="Calories" unit="kcal" value="" onChangeText={jest.fn()} />);
    expect(screen.getByLabelText('Calories, kcal')).toBeOnTheScreen();
  });

  it('forwards text changes', async () => {
    const onChangeText = jest.fn();
    await renderWithProviders(<FormField label="Name" value="" onChangeText={onChangeText} />);
    await fireEvent.changeText(screen.getByLabelText('Name'), 'Eggs');
    expect(onChangeText).toHaveBeenCalledWith('Eggs');
  });

  it('DS-09 / UX-00: shows the error below the field as an alert with words, not color only', async () => {
    await renderWithProviders(<FormField label="Calories" value="0" error="Enter 1–10,000 kcal." />);
    expect(screen.getByRole('alert')).toHaveTextContent(/Enter 1–10,000 kcal\./);
    expect(screen.getByLabelText('Calories').props.accessibilityHint).toBe('Enter 1–10,000 kcal.');
  });

  it('DS-10: disabled fields are not editable', async () => {
    await renderWithProviders(<FormField label="Name" value="Lunch" disabled />);
    expect(screen.getByLabelText('Name').props.editable).toBe(false);
  });
});

describe('DS-12: InlineStatus', () => {
  it('DS-10: shows words plus an optional action', async () => {
    const onPress = jest.fn();
    await renderWithProviders(
      <InlineStatus tone="info" message="Using default goals" action={{ label: 'Set goals', onPress }} />,
    );
    expect(screen.getByText('Using default goals')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Set goals' }));
    expect(onPress).toHaveBeenCalled();
  });

  it('DS-10: errors are announced as alerts', async () => {
    await renderWithProviders(<InlineStatus tone="error" message="Couldn't save. Try again." />);
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't save. Try again.");
  });

  it('DS-10: loading shows a spinner with its message', async () => {
    await renderWithProviders(<InlineStatus tone="loading" message="Searching Open Food Facts" />);
    expect(screen.getByText('Searching Open Food Facts')).toBeOnTheScreen();
  });
});

describe('DS-12: ProgressTrack', () => {
  it.each<[number, `${number}%`]>([
    [0.5, '50%'],
    [1.7, '100%'],
    [-1, '0%'],
    [Number.NaN, '0%'],
  ])('DS-08: clamps %p to a %s fill', async (progress, width) => {
    await renderWithProviders(<ProgressTrack progress={progress} testID="track" />);
    expect(screen.getByTestId('track-fill', { includeHiddenElements: true })).toHaveStyle({ width });
  });

  it('DS-11: is decorative (the parent label carries the numbers)', async () => {
    await renderWithProviders(<ProgressTrack progress={0.3} testID="track" />);
    expect(screen.queryByTestId('track')).toBeNull();
  });
});
