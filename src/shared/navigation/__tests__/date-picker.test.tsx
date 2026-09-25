import { fireEvent, screen } from '@testing-library/react-native';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Platform } from 'react-native';

import { localDateTime } from '@/shared/dates';
import { renderWithProviders } from '@/shared/testing/render';

import { DatePicker } from '../DatePicker';

jest.mock('@react-native-community/datetimepicker', () => jest.requireActual('@/shared/testing/datePickerMock'));

const TODAY = '2026-09-25';

async function setup(overrides: Partial<Parameters<typeof DatePicker>[0]> = {}) {
  const onConfirm = jest.fn();
  const onCancel = jest.fn();
  await renderWithProviders(
    <DatePicker visible value="2026-09-20" today={TODAY} onConfirm={onConfirm} onCancel={onCancel} {...overrides} />,
  );
  return { onConfirm, onCancel };
}

describe('UX-13 Date Picker (iOS: inline calendar in a sheet)', () => {
  it('UX-13 / NAV-05: opens on the active date; Done confirms the picked date', async () => {
    const { onConfirm } = await setup();
    const calendar = await screen.findByTestId('date-picker-calendar');
    expect(calendar.props.value).toEqual(localDateTime('2026-09-20', 12));
    await fireEvent(calendar, 'onChange', { type: 'set' }, localDateTime('2026-10-03', 12));
    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
    expect(onConfirm).toHaveBeenCalledWith('2026-10-03');
  });

  it('UX-13: any date is allowed, including the far past and future', async () => {
    await setup();
    const calendar = await screen.findByTestId('date-picker-calendar');
    expect(calendar.props.minimumDate).toBeUndefined();
    expect(calendar.props.maximumDate).toBeUndefined();
  });

  it('NAV-05: Cancel changes nothing', async () => {
    const { onConfirm, onCancel } = await setup();
    const calendar = await screen.findByTestId('date-picker-calendar');
    await fireEvent(calendar, 'onChange', { type: 'set' }, localDateTime('2026-10-03', 12));
    // The Cancel action and the sheet's close handle (also "Cancel") share the cancel path (ARCH-06).
    const cancels = screen.getAllByRole('button', { name: 'Cancel' });
    expect(cancels).toHaveLength(2);
    for (const cancel of cancels) await fireEvent.press(cancel);
    expect(onCancel).toHaveBeenCalledTimes(2);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('UX-13: the Today shortcut confirms today', async () => {
    const { onConfirm } = await setup();
    await fireEvent.press(await screen.findByRole('button', { name: 'Today' }));
    expect(onConfirm).toHaveBeenCalledWith(TODAY);
  });

  it('UX-13: destination mode only changes the title', async () => {
    await setup({ title: 'Copy to date' });
    expect(await screen.findByRole('header', { name: 'Copy to date' })).toBeOnTheScreen();
  });
});

describe('UX-13 Date Picker (Android: platform calendar dialog)', () => {
  beforeEach(() => {
    jest.replaceProperty(Platform, 'OS', 'android');
    jest.mocked(DateTimePickerAndroid.open).mockClear();
  });
  afterEach(() => jest.restoreAllMocks());

  const lastOpen = () => jest.mocked(DateTimePickerAndroid.open).mock.calls.at(-1)![0];

  it('UX-13: opens the dialog on the active date with Cancel, Done and Today', async () => {
    await setup();
    expect(DateTimePickerAndroid.open).toHaveBeenCalledTimes(1);
    const args = lastOpen();
    expect(args.value).toEqual(localDateTime('2026-09-20', 12));
    expect([args.negativeButton?.label, args.positiveButton?.label, args.neutralButton?.label]).toEqual([
      'Cancel',
      'Done',
      'Today',
    ]);
  });

  it('NAV-05: set → confirm; Today → today; dismiss → cancel', async () => {
    const { onConfirm, onCancel } = await setup();
    const { onChange } = lastOpen();
    onChange!({ type: 'set', nativeEvent: { timestamp: 0, utcOffset: 0 } }, localDateTime('2027-01-01', 12));
    expect(onConfirm).toHaveBeenLastCalledWith('2027-01-01');
    onChange!({ type: 'neutralButtonPressed', nativeEvent: { timestamp: 0, utcOffset: 0 } });
    expect(onConfirm).toHaveBeenLastCalledWith(TODAY);
    onChange!({ type: 'dismissed', nativeEvent: { timestamp: 0, utcOffset: 0 } });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('UX-13: the dialog does not open while the picker is hidden', async () => {
    await setup({ visible: false });
    expect(DateTimePickerAndroid.open).not.toHaveBeenCalled();
  });
});
