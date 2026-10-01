import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';

import { renderApp } from '@/shared/testing/appRoutes';

// Route tests run the real startup on a fresh seeded SQLite database (meals Breakfast, Lunch, Dinner, Snacks).

async function flush() {
  for (let i = 0; i < 3; i += 1) {
    await act(async () => {
      jest.advanceTimersByTime(500);
    });
  }
}

const activeDay = () => within(screen.getByTestId('diary-day-list'));

afterEach(() => {
  jest.useRealTimers();
});

/** Food Search → Create custom food → Save → Food Detail; Back twice → Diary (nothing logged). */
async function createCustomFood(name: string, kcal: string) {
  await screen.findByTestId('diary-day-list');
  await fireEvent.press(activeDay().getByRole('button', { name: 'Add food to Breakfast' }));
  await flush();
  // No query: typing in Food Search would start provider searches.
  await fireEvent.press(screen.getByRole('button', { name: 'Create custom food' }));
  await flush();
  await fireEvent.changeText(screen.getByTestId('custom-food-name'), name);
  await fireEvent.changeText(screen.getByTestId('custom-food-serving'), '100');
  await fireEvent.changeText(screen.getByTestId('custom-food-energy'), kcal);
  await waitFor(() => expect(screen.getByTestId('custom-food-save')).toBeEnabled());
  await fireEvent.press(screen.getByTestId('custom-food-save'));
  await flush();
  await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
  await flush();
  await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
  await flush();
}

describe('UX-25 / NAV-06: Profile › My foods', () => {
  it('lists custom foods; tap → Meal Picker → Food Detail on the Profile stack → Add returns to My foods', async () => {
    const app = await renderApp('/diary');
    await createCustomFood('Profile porridge', '300');
    expect(app.getPathname()).toBe('/diary');

    await fireEvent.press(screen.getByRole('tab', { name: 'Profile' }));
    await flush();
    expect(await within(await screen.findByTestId('profile-my-foods')).findByText('1 food')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('profile-my-foods'));
    await flush();
    expect(app.getPathname()).toBe('/profile/my-foods');
    expect(await screen.findByRole('header', { name: 'My foods' })).toBeOnTheScreen();

    await fireEvent.press(await screen.findByText('Profile porridge'));
    await flush();
    const picker = await screen.findByTestId('meal-picker');
    await fireEvent.press(within(picker).getByRole('button', { name: 'Lunch' }));
    await flush();
    expect(app.getPathname()).toMatch(/^\/profile\/my-foods\/.+/);
    expect(await screen.findByText('Profile porridge')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('food-detail-add'));
    await flush();
    expect(app.getPathname()).toBe('/profile/my-foods');
    expect(await screen.findByTestId('food-added-toast')).toHaveTextContent('Added Profile porridge to Lunch');

    await fireEvent.press(screen.getByRole('tab', { name: 'Diary' }));
    await flush();
    expect(await activeDay().findByRole('header', { name: 'Lunch, 300 kilocalories' })).toBeOnTheScreen();
  });

  it('with no custom foods the row says None and the list explains where foods come from', async () => {
    const app = await renderApp('/profile');
    expect(await within(await screen.findByTestId('profile-my-foods')).findByText('None')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('profile-my-foods'));
    await flush();
    expect(await screen.findByText('No custom foods yet. Create them from Food Search.')).toBeOnTheScreen();
    expect(app.getPathname()).toBe('/profile/my-foods');
  });

  it('back from Food Detail returns to My foods without logging', async () => {
    const app = await renderApp('/diary');
    await createCustomFood('Back test bread', '250');
    await fireEvent.press(screen.getByRole('tab', { name: 'Profile' }));
    await flush();
    await fireEvent.press(await screen.findByTestId('profile-my-foods'));
    await flush();
    await fireEvent.press(await screen.findByText('Back test bread'));
    await flush();
    await fireEvent.press(within(await screen.findByTestId('meal-picker')).getByRole('button', { name: 'Dinner' }));
    await flush();
    await screen.findByTestId('food-detail-add');
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    await flush();
    expect(app.getPathname()).toBe('/profile/my-foods');
    expect(screen.queryByTestId('food-added-toast')).toBeNull();
  });
});
