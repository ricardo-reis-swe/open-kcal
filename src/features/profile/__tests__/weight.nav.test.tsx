import { act, fireEvent, screen, within } from '@testing-library/react-native';

import { addDays, localDateTime, toLocalDate } from '@/shared/dates';
import { renderApp } from '@/shared/testing/appRoutes';

import { formatWeightChange } from '../screens/WeightHistoryScreen';

jest.mock('@react-native-community/datetimepicker', () => jest.requireActual('@/shared/testing/datePickerMock'));

// Route tests run the real startup on a fresh seeded SQLite database (no weights; the test device seeds US units, lb).

async function flush() {
  for (let i = 0; i < 3; i += 1) {
    await act(async () => {
      jest.advanceTimersByTime(500);
    });
  }
}

afterEach(() => {
  jest.useRealTimers();
});

const sheet = () => within(screen.getByTestId('weight-entry-sheet'));

async function saveWeight(text: string) {
  await fireEvent.changeText(sheet().getByLabelText('Weight, lb'), text);
  await fireEvent.press(sheet().getByTestId('weight-entry-save'));
  await flush();
}

describe('UX-14 / NAV-07: Weight Entry Sheet', () => {
  it('Profile Update weight: create for today in lb → sheet closes, Profile shows the current weight', async () => {
    const app = await renderApp('/profile');
    await fireEvent.press(await screen.findByTestId('profile-update-weight'));
    await flush();
    expect(sheet().getByRole('header', { name: 'Update weight' })).toBeOnTheScreen();
    expect(sheet().getByTestId('weight-entry-date').props.accessibilityLabel).toMatch(/^Date, Today, /);
    expect(sheet().queryByTestId('weight-entry-delete')).toBeNull();

    // UX-00: 20–500 kg shown in the display unit; Save stays disabled until valid.
    await fireEvent.changeText(sheet().getByLabelText('Weight, lb'), '10');
    await fireEvent(sheet().getByLabelText('Weight, lb'), 'blur');
    expect(sheet().getByText('Enter a weight from 44.1 to 1,102.3 lb.')).toBeOnTheScreen();
    expect(sheet().getByTestId('weight-entry-save')).toBeDisabled();

    await saveWeight('180.5');
    expect(screen.queryByTestId('weight-entry-sheet')).toBeNull();
    expect(app.getPathname()).toBe('/profile');
    expect(await screen.findByText('Current 180.5 lb')).toBeOnTheScreen();

    // Create mode shows the current weight as the placeholder (UX-14).
    await fireEvent.press(screen.getByTestId('profile-update-weight'));
    await flush();
    expect(sheet().getByLabelText('Weight, lb').props.placeholder).toBe('180.5');
    expect(sheet().getByLabelText('Weight, lb').props.value).toBe('');
  });

  it('NAV-03: + → Update weight opens the sheet from the Diary', async () => {
    await renderApp('/diary');
    await fireEvent.press(screen.getByRole('button', { name: 'Add' }));
    await fireEvent.press(within(screen.getByTestId('add-action-sheet')).getByTestId('add-action-update-weight'));
    await flush();
    expect(screen.queryByTestId('add-action-sheet')).toBeNull();
    expect(sheet().getByRole('header', { name: 'Update weight' })).toBeOnTheScreen();
  });
});

describe('UX-18 / NAV-06: Weight History', () => {
  it('empty → add today and yesterday → newest first with change → edit → delete', async () => {
    const app = await renderApp('/profile');
    await fireEvent.press(await screen.findByTestId('profile-weight-history'));
    await flush();
    expect(app.getPathname()).toBe('/profile/weight-history');
    expect(await screen.findByText('No weight entries yet.')).toBeOnTheScreen();

    // Yesterday via the Date Picker (DATA-13: ≤ today, capped at today).
    await fireEvent.press(screen.getByTestId('weight-history-empty-add'));
    await flush();
    await fireEvent.press(sheet().getByTestId('weight-entry-date'));
    const yesterday = addDays(toLocalDate(new Date()), -1);
    expect(screen.getByTestId('date-picker-calendar').props.maximumDate).toEqual(
      localDateTime(toLocalDate(new Date()), 12),
    );
    await fireEvent(
      screen.getByTestId('date-picker-calendar'),
      'onChange',
      { type: 'set' },
      localDateTime(yesterday, 12),
    );
    await fireEvent.press(screen.getByTestId('date-picker-done'));
    await flush();
    expect(sheet().getByTestId('weight-entry-date').props.accessibilityLabel).toMatch(/^Date, Yesterday, /);
    await saveWeight('181');

    // App bar `+` (label Update weight).
    await fireEvent.press(screen.getByTestId('weight-history-add'));
    await flush();
    await saveWeight('180');

    const row0 = await screen.findByTestId('weight-history-row-0');
    expect(row0.props.accessibilityLabel).toMatch(/, 180\.0 lb, −1\.0 lb$/);
    expect(screen.getByTestId('weight-history-row-1').props.accessibilityLabel).toMatch(/, 181\.0 lb$/);

    // Row → edit mode: loads the record; Save disabled until something changed.
    await fireEvent.press(row0);
    await flush();
    expect(sheet().getByRole('header', { name: 'Edit weight' })).toBeOnTheScreen();
    expect(sheet().getByLabelText('Weight, lb').props.value).toBe('180');
    expect(sheet().getByTestId('weight-entry-save')).toBeDisabled();
    await saveWeight('179.5');
    expect(screen.getByTestId('weight-history-row-0').props.accessibilityLabel).toMatch(/, 179\.5 lb, −1\.5 lb$/);

    // Delete (edit only) is confirmed (UX-19, NAV-08); current weight recomputes.
    await fireEvent.press(screen.getByTestId('weight-history-row-0'));
    await flush();
    await fireEvent.press(sheet().getByTestId('weight-entry-delete'));
    const dialog = within(screen.getByTestId('weight-entry-delete-dialog'));
    expect(dialog.getByText('Delete weight entry?')).toBeOnTheScreen();
    expect(dialog.getByText(/^179\.5 lb on /)).toBeOnTheScreen();
    await fireEvent.press(dialog.getByRole('button', { name: 'Delete weight' }));
    await flush();
    expect(screen.queryByTestId('weight-entry-sheet')).toBeNull();
    expect(screen.queryByTestId('weight-history-row-1')).toBeNull();
    expect(screen.getByTestId('weight-history-row-0').props.accessibilityLabel).toMatch(/, 181\.0 lb$/);

    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    await flush();
    expect(await screen.findByText('Current 181.0 lb')).toBeOnTheScreen();
  });

  it('UX-18: change vs previous uses the display unit, a minus sign and no sign at zero', () => {
    expect(formatWeightChange(-0.4, 'kg', 'en-GB')).toBe('−0.4');
    expect(formatWeightChange(0.5, 'kg', 'en-GB')).toBe('+0.5');
    expect(formatWeightChange(0.01, 'kg', 'en-GB')).toBe('0.0');
    expect(formatWeightChange(-0.4536, 'lb', 'pt-PT')).toBe('−1,0');
  });
});
