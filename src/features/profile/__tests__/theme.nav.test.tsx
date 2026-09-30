import { act, fireEvent, screen } from '@testing-library/react-native';
import { Appearance } from 'react-native';

import { renderApp } from '@/shared/testing/appRoutes';

// Route tests run the real startup on a fresh seeded SQLite database (theme `system`, DATA-23).

async function flush() {
  for (let i = 0; i < 3; i += 1) {
    await act(async () => {
      jest.advanceTimersByTime(500);
    });
  }
}

let setColorScheme: jest.SpyInstance;
beforeEach(() => {
  setColorScheme = jest.spyOn(Appearance, 'setColorScheme').mockImplementation(() => undefined);
});
afterEach(() => {
  setColorScheme.mockRestore();
  jest.useRealTimers();
});

describe('NAV-06 / UX-23: Theme route', () => {
  it('Profile shows the stored theme; a choice saves, applies at once and shows on Profile', async () => {
    const app = await renderApp('/profile');
    expect(await screen.findByText('System')).toBeOnTheScreen();
    expect(setColorScheme).toHaveBeenLastCalledWith('unspecified');

    await fireEvent.press(screen.getByTestId('profile-theme'));
    await flush();
    expect(app.getPathname()).toBe('/profile/theme');
    expect(await screen.findByTestId('theme-system')).toBeSelected();

    await fireEvent.press(screen.getByTestId('theme-dark'));
    await flush();
    expect(screen.getByTestId('theme-dark')).toBeSelected();
    expect(setColorScheme).toHaveBeenLastCalledWith('dark');

    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    await flush();
    expect(app.getPathname()).toBe('/profile');
    expect(await screen.findByText('Dark')).toBeOnTheScreen();
  });
});
