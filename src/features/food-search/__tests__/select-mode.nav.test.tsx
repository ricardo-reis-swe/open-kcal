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

async function createCustomFood(name: string) {
  await screen.findByTestId('diary-day-list');
  await fireEvent.press(activeDay().getByRole('button', { name: 'Add food to Breakfast' }));
  await flush();
  await fireEvent.press(screen.getByTestId('food-search-tab-custom'));
  await flush();
  await fireEvent.press(screen.getByRole('button', { name: 'Create custom food' }));
  await flush();
  await fireEvent.changeText(screen.getByTestId('custom-food-name'), name);
  await fireEvent.changeText(screen.getByTestId('custom-food-serving'), '100');
  await fireEvent.changeText(screen.getByTestId('custom-food-energy'), '200');
  await waitFor(() => expect(screen.getByTestId('custom-food-save')).toBeEnabled());
  await fireEvent.press(screen.getByTestId('custom-food-save'));
  await flush();
  await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
  await flush();
  await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
  await flush();
}

describe('UX-04 / NAV-04: select mode Add', () => {
  it('Back leaves select mode first; Add to <meal> logs every pick and lands on the Diary', async () => {
    const app = await renderApp('/diary');
    await createCustomFood('Toast');
    await createCustomFood('Jam');
    await fireEvent.press(activeDay().getByRole('button', { name: 'Add food to Lunch' }));
    await flush();
    await fireEvent.press(screen.getByTestId('food-search-tab-custom'));
    await flush();
    await fireEvent.press(screen.getByRole('button', { name: 'Select multiple' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    await flush();
    expect(app.getPathname()).toBe('/diary/food-search');
    expect(screen.queryByTestId('food-search-add-selected')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Select multiple' }));
    await fireEvent.press(await screen.findByText('Toast'));
    await fireEvent.press(screen.getByText('Jam'));
    await fireEvent.press(screen.getByRole('button', { name: 'Add to Lunch' }));
    await flush();

    expect(app.getPathname()).toBe('/diary');
    expect(await activeDay().findByText('Toast')).toBeOnTheScreen();
    expect(activeDay().getByText('Jam')).toBeOnTheScreen();
  });
});
