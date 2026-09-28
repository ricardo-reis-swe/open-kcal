import { act, fireEvent, screen, within } from '@testing-library/react-native';

import { renderApp } from '@/shared/testing/appRoutes';

// Route tests run the real startup on a fresh seeded SQLite database (provisional 2,000 kcal goal; the test device seeds US units, DATA-17).

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

describe('NAV-06 / UX-18: Units and Weight Goal routes', () => {
  it('a unit change saves immediately and shows everywhere: Profile rows and the Diary (DATA-04)', async () => {
    const app = await renderApp('/profile');
    await fireEvent.press(await screen.findByTestId('profile-units'));
    await flush();
    expect(app.getPathname()).toBe('/profile/units');
    await fireEvent.press(await screen.findByTestId('units-energyUnit-kJ'));
    await flush();
    expect(screen.getByTestId('units-energyUnit-kJ')).toBeSelected();
    await fireEvent.press(screen.getByTestId('units-weightUnit-kg'));
    await flush();
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    await flush();
    expect(app.getPathname()).toBe('/profile');
    expect(await screen.findByText('kg · oz · kJ · fl oz')).toBeOnTheScreen();
    expect(screen.getByText('8,368 kJ')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('tab-diary'));
    await flush();
    expect(await activeDay().findByLabelText(/Calories remaining, 8,368 of 8,368 kilojoules/)).toBeOnTheScreen();
  });

  it('Weight Goal: save in the display unit → Profile; Clear goal → Profile shows none', async () => {
    const app = await renderApp('/profile');
    await fireEvent.press(await screen.findByTestId('profile-weight-goal'));
    await flush();
    expect(app.getPathname()).toBe('/profile/weight-goal');
    await fireEvent.changeText(await screen.findByLabelText('Goal weight, lb'), '165.5');
    await fireEvent.press(screen.getByTestId('weight-goal-save'));
    await flush();
    expect(app.getPathname()).toBe('/profile');
    expect(await screen.findByText('Goal 165.5 lb')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('profile-weight-goal'));
    await flush();
    expect((await screen.findByLabelText('Goal weight, lb')).props.value).toBe('165.5');
    await fireEvent.press(screen.getByTestId('weight-goal-clear'));
    await flush();
    expect(app.getPathname()).toBe('/profile');
    expect(await screen.findByText('Goal —')).toBeOnTheScreen();
  });
});
