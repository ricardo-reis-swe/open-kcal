import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { router } from 'expo-router';

import { addDays, localDateTime, toLocalDate } from '@/shared/dates';
import { routes } from '@/shared/navigation/routes';
import { renderApp } from '@/shared/testing/appRoutes';

jest.mock('@react-native-community/datetimepicker', () => jest.requireActual('@/shared/testing/datePickerMock'));

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

async function logDinner450() {
  await fireEvent.press(screen.getByTestId('tab-add'));
  await fireEvent.press(screen.getByRole('button', { name: 'Quick calories' }));
  await flush();
  await fireEvent.press(within(await screen.findByTestId('meal-picker')).getByRole('button', { name: 'Dinner' }));
  await flush();
  await fireEvent.changeText(screen.getByLabelText('Calories, kcal'), '450');
  await fireEvent.press(screen.getByTestId('quick-calories-submit'));
  await flush();
}

async function copyVia(row: 'copy-meal-today' | 'copy-meal-tomorrow' | 'copy-meal-choose') {
  await fireEvent.press(screen.getByTestId('meal-detail-copy'));
  await flush();
  await fireEvent.press(within(screen.getByTestId('copy-meal-sheet')).getByTestId(row));
  await flush();
}

/** Opens the same meal on another date by route (IDs only, NAV-09) and reads its total. */
async function totalOn(mealPath: string, date: string) {
  await act(async () => router.push(routes.mealDetail({ mealId: mealPath.split('/').pop()!, date })));
  await flush();
  return screen.getByLabelText(/^Total, /).props.accessibilityLabel as string;
}

describe('UX-12 / NAV-07: Copy Meal', () => {
  it('UX-12: the sheet names the meal, offers Today / Tomorrow / Choose date…; closing it copies nothing', async () => {
    const app = await renderApp('/diary');
    await logDinner450();
    await openMealDetail('Dinner');
    const detail = app.getPathname();

    await fireEvent.press(screen.getByTestId('meal-detail-copy'));
    await flush();
    const sheet = within(screen.getByTestId('copy-meal-sheet'));
    expect(sheet.getByRole('header', { name: 'Copy Dinner to' })).toBeOnTheScreen();
    expect(sheet.getByRole('button', { name: /^Today · / })).toBeOnTheScreen();
    expect(sheet.getByRole('button', { name: /^Tomorrow · / })).toBeOnTheScreen();
    expect(sheet.getByRole('button', { name: 'Choose date…' })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    await flush();
    expect(screen.queryByTestId('copy-meal-sheet')).toBeNull();
    expect(screen.queryByTestId('meal-detail-toast')).toBeNull();
    expect(app.getPathname()).toBe(detail);
    const today = toLocalDate(new Date());
    expect(await totalOn(detail, addDays(today, 1))).toBe('Total, 0 kilocalories');
  });

  it('NAV-07: Tomorrow copies into the same meal tomorrow, stays on the source Meal Detail with a toast', async () => {
    const app = await renderApp('/diary');
    await logDinner450();
    await openMealDetail('Dinner');
    const detail = app.getPathname();

    await copyVia('copy-meal-tomorrow');
    expect(app.getPathname()).toBe(detail);
    expect(screen.getByText(/^Copied 1 item to Dinner, /)).toBeOnTheScreen();
    // The source is unchanged.
    expect(screen.getByLabelText('Total, 450 kilocalories')).toBeOnTheScreen();

    // Back → Diary on the source date (NAV-04); Tomorrow's Dinner now has the copy.
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    await flush();
    expect(app.getPathname()).toBe('/diary');
    expect(screen.getByLabelText('Showing Today')).toBeOnTheScreen();
    const today = toLocalDate(new Date());
    expect(await totalOn(detail, addDays(today, 1))).toBe('Total, 450 kilocalories');
  });

  it('NAV-07: the shortcuts are absolute even from tomorrow; copying onto the source date appends duplicates', async () => {
    const app = await renderApp('/diary');
    await logDinner450();
    await openMealDetail('Dinner');
    const detail = app.getPathname();
    const today = toLocalDate(new Date());
    const tomorrow = addDays(today, 1);

    await copyVia('copy-meal-tomorrow');
    await totalOn(detail, tomorrow);
    // Source = tomorrow: "Tomorrow" is still absolute tomorrow (the source date → duplicates).
    await copyVia('copy-meal-tomorrow');
    expect(screen.getByText(/^Copied 1 item to Dinner, /)).toBeOnTheScreen();
    expect(screen.getByLabelText('Total, 900 kilocalories')).toBeOnTheScreen();
    // "Today" is absolute today, not the day before the source.
    await copyVia('copy-meal-today');
    expect(screen.getByText(/^Copied 2 items to Dinner, /)).toBeOnTheScreen();
    expect(screen.getByLabelText('Total, 900 kilocalories')).toBeOnTheScreen();
    expect(await totalOn(detail, today)).toBe('Total, 1,350 kilocalories');
  });

  it('UX-13 / NAV-07: Choose date… opens the Date Picker titled Copy to date; Done copies to the picked date', async () => {
    const app = await renderApp('/diary');
    await logDinner450();
    await openMealDetail('Dinner');
    const detail = app.getPathname();
    const picked = addDays(toLocalDate(new Date()), 10);

    await copyVia('copy-meal-choose');
    expect(screen.queryByTestId('copy-meal-sheet')).toBeNull();
    expect(screen.getByRole('header', { name: 'Copy to date' })).toBeOnTheScreen();
    await fireEvent(screen.getByTestId('date-picker-calendar'), 'onChange', { type: 'set' }, localDateTime(picked, 12));
    await fireEvent.press(screen.getByTestId('date-picker-done'));
    await flush();

    expect(app.getPathname()).toBe(detail);
    expect(screen.getByText(/^Copied 1 item to Dinner, /)).toBeOnTheScreen();
    expect(await totalOn(detail, picked)).toBe('Total, 450 kilocalories');
  });

  it('UX-13: cancelling the Date Picker copies nothing', async () => {
    const app = await renderApp('/diary');
    await logDinner450();
    await openMealDetail('Dinner');
    const detail = app.getPathname();

    await copyVia('copy-meal-choose');
    await fireEvent.press(screen.getByTestId('date-picker-cancel'));
    await flush();
    expect(screen.queryByTestId('meal-detail-toast')).toBeNull();
    expect(app.getPathname()).toBe(detail);
  });
});
