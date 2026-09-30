import { act, fireEvent, screen } from '@testing-library/react-native';

import { requestWidgetToday } from '@/shared/navigation/widgetLink';
import { renderApp } from '@/shared/testing/appRoutes';

async function onTomorrow() {
  await renderApp('/diary');
  expect(await screen.findByLabelText('Showing Today')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Next day, Tomorrow' }));
  expect(screen.getByLabelText('Showing Tomorrow')).toBeOnTheScreen();
}

describe('NAV-10: widget tap while the app runs', () => {
  it('at the Diary root, the date becomes today (as the Today action)', async () => {
    await onTomorrow();
    await act(async () => requestWidgetToday());
    expect(screen.getByLabelText('Showing Today')).toBeOnTheScreen();
  });

  it('with the date picker open, nothing changes', async () => {
    await onTomorrow();
    await fireEvent.press(screen.getByRole('button', { name: 'Choose date' }));
    await act(async () => requestWidgetToday());
    expect(screen.getByLabelText('Showing Tomorrow')).toBeOnTheScreen();
  });

  it('on the Profile tab, nothing changes', async () => {
    await onTomorrow();
    await fireEvent.press(screen.getByRole('tab', { name: 'Profile' }));
    await act(async () => requestWidgetToday());
    await fireEvent.press(screen.getByRole('tab', { name: 'Diary' }));
    expect(screen.getByLabelText('Showing Tomorrow')).toBeOnTheScreen();
  });

  it('with a sheet open over the Diary root (Add Action Sheet), nothing changes', async () => {
    await onTomorrow();
    await fireEvent.press(screen.getByRole('button', { name: 'Add' }));
    expect(await screen.findByText('Quick calories')).toBeOnTheScreen();
    await act(async () => requestWidgetToday());
    expect(screen.getByLabelText('Showing Tomorrow', { includeHiddenElements: true })).toBeOnTheScreen();
  });
});
