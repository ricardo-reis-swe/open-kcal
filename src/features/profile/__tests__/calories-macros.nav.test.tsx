import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { router } from 'expo-router';

import { renderApp } from '@/shared/testing/appRoutes';

// Route tests run the real startup on a fresh seeded SQLite database (provisional goals, UX-01).

async function flush() {
  for (let i = 0; i < 3; i += 1) {
    await act(async () => {
      jest.advanceTimersByTime(500);
    });
  }
}

const activeDay = () => within(screen.getByTestId('diary-page-active'));

afterEach(() => {
  jest.useRealTimers();
});

describe('UX-16 / NAV-06 / UX-01: Calories & Macros routes', () => {
  it('UX-01: Diary `Set goals` → Calories & Macros; the first save → Profile and the default-goals row is gone', async () => {
    const app = await renderApp('/diary');
    await fireEvent.press(await activeDay().findByRole('button', { name: 'Set goals' }));
    await flush();
    expect(app.getPathname()).toBe('/profile/calories-macros');
    await fireEvent.changeText(await screen.findByLabelText('Calories, kcal'), '2200');
    await fireEvent.press(screen.getByTestId('goals-save'));
    await flush();
    expect(app.getPathname()).toBe('/profile');
    expect(await screen.findByText('2,200 kcal')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('tab-diary'));
    await flush();
    expect(await activeDay().findByLabelText(/Calories remaining, 2,200 of 2,200/)).toBeOnTheScreen();
    expect(activeDay().queryByText('Using default goals')).toBeNull();
  });

  it('NAV-01: back from the Diary entry follows the Profile stack (the hub is underneath)', async () => {
    const app = await renderApp('/diary');
    await fireEvent.press(await activeDay().findByRole('button', { name: 'Set goals' }));
    await flush();
    await screen.findByLabelText('Calories, kcal');
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    await flush();
    expect(app.getPathname()).toBe('/profile');
    expect(await screen.findByTestId('profile-calories-macros')).toBeOnTheScreen();
  });

  it('ARCH-06: a system back on a dirty form runs the same Discard changes? path', async () => {
    const app = await renderApp('/profile');
    await fireEvent.press(await screen.findByTestId('profile-calories-macros'));
    await flush();
    await fireEvent.changeText(await screen.findByLabelText('Fat, g'), '70');
    await act(async () => router.back());
    await flush();
    expect(app.getPathname()).toBe('/profile/calories-macros');
    await fireEvent.press(screen.getByRole('button', { name: 'Discard' }));
    await flush();
    expect(app.getPathname()).toBe('/profile');
  });

  it('NAV-06: the Profile row opens Calories & Macros and back returns to Profile', async () => {
    const app = await renderApp('/profile');
    await fireEvent.press(await screen.findByTestId('profile-calories-macros'));
    await flush();
    expect(app.getPathname()).toBe('/profile/calories-macros');
    await screen.findByLabelText('Calories, kcal');
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    await flush();
    expect(app.getPathname()).toBe('/profile');
  });
});
