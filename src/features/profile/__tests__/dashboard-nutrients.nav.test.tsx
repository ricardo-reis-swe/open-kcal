import { act, fireEvent, screen, within } from '@testing-library/react-native';

import { renderApp } from '@/shared/testing/appRoutes';

// Route tests run the real startup on a fresh seeded SQLite database (DATA-21 default: 4 nutrients shown).

async function flush() {
  for (let i = 0; i < 3; i += 1) {
    await act(async () => {
      jest.advanceTimersByTime(500);
    });
  }
}

const shownOrder = () =>
  within(screen.getByTestId('dashboard-nutrients'))
    .queryAllByTestId(/^dashboard-nutrient-row-/)
    .map((row) => row.props.testID.replace('dashboard-nutrient-row-', ''));

afterEach(() => {
  jest.useRealTimers();
});

describe('NAV-06 / UX-21: Dashboard nutrients', () => {
  it('Profile row opens it; switches and moves save immediately and Profile shows the count', async () => {
    const app = await renderApp('/profile');
    await fireEvent.press(await screen.findByTestId('profile-dashboard-nutrients'));
    await flush();
    expect(app.getPathname()).toBe('/profile/dashboard-nutrients');
    expect(await screen.findByRole('header', { name: 'Dashboard nutrients' })).toBeOnTheScreen();
    expect(shownOrder()).toEqual(['fibre', 'sugars', 'saturated_fat', 'salt']);
    // Hidden nutrients list by group, in catalog order.
    const minerals = screen.getByTestId('dashboard-nutrients-group-minerals');
    expect(within(minerals).getByTestId('dashboard-nutrient-switch-sodium')).toBeOnTheScreen();

    // On → appended to Shown.
    await fireEvent(screen.getByTestId('dashboard-nutrient-switch-iron'), 'valueChange', true);
    await flush();
    expect(shownOrder()).toEqual(['fibre', 'sugars', 'saturated_fat', 'salt', 'iron']);
    // a11y Move up.
    await fireEvent(screen.getByTestId('dashboard-nutrient-row-iron'), 'accessibilityAction', {
      nativeEvent: { actionName: 'moveUp' },
    });
    await flush();
    expect(shownOrder()).toEqual(['fibre', 'sugars', 'saturated_fat', 'iron', 'salt']);
    // Off → back to its group.
    await fireEvent(screen.getByTestId('dashboard-nutrient-switch-sugars'), 'valueChange', false);
    await flush();
    expect(shownOrder()).toEqual(['fibre', 'saturated_fat', 'iron', 'salt']);
    expect(
      within(screen.getByTestId('dashboard-nutrients-group-fatsSugars')).getByTestId(
        'dashboard-nutrient-switch-sugars',
      ),
    ).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    await flush();
    expect(app.getPathname()).toBe('/profile');
    expect(await screen.findByText('4 shown')).toBeOnTheScreen();
  });

  it('zero shown is allowed and explained; Profile says None', async () => {
    const app = await renderApp('/profile');
    await fireEvent.press(await screen.findByTestId('profile-dashboard-nutrients'));
    await flush();
    await screen.findByTestId('dashboard-nutrients');
    for (const id of ['fibre', 'sugars', 'saturated_fat', 'salt']) {
      await fireEvent(screen.getByTestId(`dashboard-nutrient-switch-${id}`), 'valueChange', false);
      await flush();
    }
    expect(screen.getByText('The Diary shows no nutrient panel.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    await flush();
    expect(app.getPathname()).toBe('/profile');
    expect(within(await screen.findByTestId('profile-dashboard-nutrients')).getByText('None')).toBeOnTheScreen();
  });
});
