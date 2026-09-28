import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { router } from 'expo-router';

import { renderApp } from '@/shared/testing/appRoutes';

// Route tests run the real startup on a fresh seeded SQLite database (meals Breakfast, Lunch, Dinner, Snacks).

async function flush() {
  // Bounded: running every pending timer would also fire the Diary's midnight rollover (see quick-calories.nav).
  for (let i = 0; i < 3; i += 1) {
    await act(async () => {
      jest.advanceTimersByTime(500);
    });
  }
}

const activeDay = () => within(screen.getByTestId('diary-day-list'));
const LONG_DATE = /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), /;

afterEach(() => {
  jest.useRealTimers();
});

async function openMealDetail(meal: string) {
  await screen.findByTestId('diary-day-list');
  await fireEvent.press(activeDay().getByRole('header', { name: new RegExp(`^${meal}, `) }));
  await flush();
  await screen.findByTestId('meal-detail');
}

describe('UX-03 / NAV-04: Meal Detail', () => {
  it('NAV-04: a Diary meal header opens Meal Detail; empty state; Copy meal disabled; back → Diary, same date', async () => {
    const app = await renderApp('/diary');
    await fireEvent.press(await screen.findByRole('button', { name: 'Next day, Tomorrow' }));
    await openMealDetail('Breakfast');

    expect(app.getPathname()).toMatch(/^\/diary\/meal\/.+/);
    expect(screen.getByRole('header', { name: 'Breakfast' })).toBeOnTheScreen();
    expect(screen.getByText(LONG_DATE)).toBeOnTheScreen();
    expect(screen.getByLabelText('Total, 0 kilocalories')).toBeOnTheScreen();
    expect(screen.getByText('No foods logged for this meal.')).toBeOnTheScreen();
    expect(screen.getByTestId('meal-detail-copy')).toBeDisabled();

    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    await flush();
    expect(app.getPathname()).toBe('/diary');
    expect(screen.getByLabelText('Showing Tomorrow')).toBeOnTheScreen();
  });

  it('NAV-04: + Add food opens Food Search for this meal and date; back returns to Meal Detail', async () => {
    const app = await renderApp('/diary');
    await openMealDetail('Lunch');
    const detail = app.getPathname();

    await fireEvent.press(screen.getByTestId('meal-detail-add-food'));
    await flush();
    expect(app.getPathname()).toBe('/diary/food-search');
    expect(screen.getByText('Adding to Lunch · Today')).toBeOnTheScreen();

    await act(async () => router.back());
    await flush();
    expect(app.getPathname()).toBe(detail);
    // The app bar `+` is the same action (UX-03).
    await fireEvent.press(screen.getByRole('button', { name: 'Add food to Lunch' }));
    await flush();
    expect(app.getPathname()).toBe('/diary/food-search');
  });

  it('NAV-04: entries show with the total; Copy meal is enabled; an entry opens its edit screen and returns here', async () => {
    const app = await renderApp('/diary');
    await fireEvent.press(screen.getByTestId('tab-add'));
    await fireEvent.press(screen.getByRole('button', { name: 'Quick calories' }));
    await flush();
    await fireEvent.press(within(await screen.findByTestId('meal-picker')).getByRole('button', { name: 'Dinner' }));
    await flush();
    await fireEvent.changeText(screen.getByLabelText('Calories, kcal'), '450');
    await fireEvent.press(screen.getByTestId('quick-calories-submit'));
    await flush();

    await openMealDetail('Dinner');
    const detail = app.getPathname();
    expect(screen.getByLabelText('Total, 450 kilocalories')).toBeOnTheScreen();
    expect(screen.queryByText('No foods logged for this meal.')).toBeNull();
    expect(screen.getByTestId('meal-detail-copy')).toBeEnabled();

    await fireEvent.press(screen.getByRole('button', { name: /^Quick Calories, 450 kilocalories/ }));
    await flush();
    expect(app.getPathname()).toMatch(/^\/diary\/quick-calories\/.+/);
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    await flush();
    expect(app.getPathname()).toBe(detail);
  });

  it.each([
    ['an unknown or deleted meal', '/diary/meal/no-such-meal?date=2026-09-25'],
    ['a bad date', '/diary/meal/no-such-meal?date=2026-02-30'],
  ])('UX-00: %s shows Not found with a way back to the Diary', async (_label, url) => {
    const app = await renderApp(url);
    expect(await screen.findByText('This item no longer exists.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Back to Diary' }));
    await flush();
    expect(app.getPathname()).toBe('/diary');
  });
});
