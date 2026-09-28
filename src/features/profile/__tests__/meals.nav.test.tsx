import { act, fireEvent, screen } from '@testing-library/react-native';

import { renderApp } from '@/shared/testing/appRoutes';

// Route tests run the real startup on a fresh seeded SQLite database.

async function flush() {
  for (let i = 0; i < 3; i += 1) {
    await act(async () => {
      jest.advanceTimersByTime(500);
    });
  }
}

afterEach(() => {
  jest.useRealTimers();
});

describe('NAV-06 / UX-17: Meals routes', () => {
  it('Profile `Meals` → Meals → Add meal → Save → Meals (new meal last) → back → Profile shows the count', async () => {
    const app = await renderApp('/profile');
    await fireEvent.press(await screen.findByTestId('profile-meals'));
    await flush();
    expect(app.getPathname()).toBe('/profile/meals');
    await fireEvent.press(await screen.findByTestId('meals-add'));
    await flush();
    expect(app.getPathname()).toBe('/profile/meals/new');
    await fireEvent.changeText(await screen.findByLabelText('Name'), 'Supper');
    await fireEvent.press(screen.getByTestId('meal-save'));
    await flush();
    expect(app.getPathname()).toBe('/profile/meals');
    expect(await screen.findByTestId('meals-row-4')).toHaveTextContent('Supper');
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    await flush();
    expect(app.getPathname()).toBe('/profile');
    expect(await screen.findByText('5 meals')).toBeOnTheScreen();
  });

  it('row tap → Edit Meal; delete → back to Meals without the meal', async () => {
    const app = await renderApp('/profile/meals');
    await fireEvent.press(await screen.findByTestId('meals-row-2'));
    await flush();
    expect(app.getPathname()).toMatch(/^\/profile\/meals\/[^/]+$/);
    expect((await screen.findByLabelText('Name')).props.value).toBe('Dinner');
    await fireEvent.press(screen.getByTestId('meal-delete'));
    await fireEvent.press(await screen.findByTestId('meal-delete-dialog-confirm'));
    await flush();
    expect(app.getPathname()).toBe('/profile/meals');
    expect(screen.queryByText('Dinner')).toBeNull();
    expect(screen.getByTestId('meals-row-2')).toHaveTextContent('Snacks');
  });
});
