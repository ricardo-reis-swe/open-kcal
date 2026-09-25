import { fireEvent, screen } from '@testing-library/react-native';

import { renderApp } from '@/shared/testing/appRoutes';

describe('NAV-05: selected diary date', () => {
  it('NAV-05: fresh launch is today, and the selected date survives a tab switch', async () => {
    await renderApp('/diary');
    expect(await screen.findByLabelText('Showing Today')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Next day, Tomorrow' }));
    expect(screen.getByLabelText('Showing Tomorrow')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('tab', { name: 'Profile' }));
    await fireEvent.press(screen.getByRole('tab', { name: 'Diary' }));
    expect(screen.getByLabelText('Showing Tomorrow')).toBeOnTheScreen();
  });
});
