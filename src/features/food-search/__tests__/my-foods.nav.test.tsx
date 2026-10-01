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
  // UX-04: Create custom food lives on the My foods tab.
  await fireEvent.press(screen.getByTestId('food-search-tab-custom'));
  await flush();
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

async function openMyFoods() {
  await fireEvent.press(screen.getByRole('tab', { name: 'Profile' }));
  await flush();
  await fireEvent.press(await screen.findByTestId('profile-my-foods'));
  await flush();
}

describe('UX-25 / NAV-06: Profile › My foods', () => {
  it('a tap shows the food in the edit form; Save updates it, entries keep their snapshot (DATA-26)', async () => {
    const app = await renderApp('/diary');
    await createCustomFood('Profile porridge', '300');
    // Log it once, so the edit must leave this entry alone (DATA-05).
    await fireEvent.press(activeDay().getByRole('button', { name: 'Add food to Lunch' }));
    await flush();
    await fireEvent.press(screen.getByTestId('food-search-tab-custom')); // UX-04: lists it with no query
    await fireEvent.press(await screen.findByText('Profile porridge'));
    await flush();
    await fireEvent.press(screen.getByTestId('food-detail-add'));
    await flush();
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    await flush();

    await openMyFoods();
    expect(app.getPathname()).toBe('/profile/my-foods');
    await fireEvent.press(await screen.findByText('Profile porridge'));
    await flush();
    expect(app.getPathname()).toMatch(/^\/profile\/my-foods\/.+/);
    expect(await screen.findByRole('header', { name: 'Edit food' })).toBeOnTheScreen();
    expect(screen.getByTestId('custom-food-name').props.value).toBe('Profile porridge');
    expect(screen.getByTestId('custom-food-serving').props.value).toBe('100');
    expect(screen.getByTestId('custom-food-energy').props.value).toBe('300');
    expect(screen.getByTestId('custom-food-save')).toBeDisabled(); // UX-00: nothing changed yet

    await fireEvent.changeText(screen.getByTestId('custom-food-name'), 'Oat porridge');
    await fireEvent.changeText(screen.getByTestId('custom-food-energy'), '350');
    await waitFor(() => expect(screen.getByTestId('custom-food-save')).toBeEnabled());
    await fireEvent.press(screen.getByTestId('custom-food-save'));
    await flush();
    expect(app.getPathname()).toBe('/profile/my-foods');
    expect(await screen.findByText('Oat porridge')).toBeOnTheScreen();
    expect(screen.queryByText('Profile porridge')).toBeNull();

    await fireEvent.press(screen.getByRole('tab', { name: 'Diary' }));
    await flush();
    expect(await activeDay().findByRole('header', { name: 'Lunch, 300 kilocalories' })).toBeOnTheScreen();
  });

  it('Delete food asks first, then removes it from the list', async () => {
    const app = await renderApp('/diary');
    await createCustomFood('Back test bread', '250');
    await openMyFoods();
    await fireEvent.press(await screen.findByText('Back test bread'));
    await flush();
    await fireEvent.press(await screen.findByTestId('custom-food-delete'));
    expect(await screen.findByText('Delete Back test bread?')).toBeOnTheScreen();
    await fireEvent.press(
      within(screen.getByTestId('custom-food-delete-dialog')).getByRole('button', { name: 'Delete food' }),
    );
    await flush();
    expect(app.getPathname()).toBe('/profile/my-foods');
    expect(await screen.findByText('No custom foods yet. Create them from Food Search.')).toBeOnTheScreen();
  });

  it('with no custom foods the row says None and the list explains where foods come from', async () => {
    const app = await renderApp('/profile');
    expect(await within(await screen.findByTestId('profile-my-foods')).findByText('None')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('profile-my-foods'));
    await flush();
    expect(await screen.findByText('No custom foods yet. Create them from Food Search.')).toBeOnTheScreen();
    expect(app.getPathname()).toBe('/profile/my-foods');
  });
});
