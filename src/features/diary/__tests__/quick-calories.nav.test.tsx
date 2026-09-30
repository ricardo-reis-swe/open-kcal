import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { router } from 'expo-router';

import { renderApp } from '@/shared/testing/appRoutes';

// Route tests run the real startup on a fresh seeded SQLite database (meals Breakfast, Lunch, Dinner, Snacks).

async function flush() {
  // Sheet close animations and router transitions run on the fake timers expo-router's harness installs. Advance a
  // bounded time: running every pending timer would also fire the Diary's midnight rollover and change "today".
  for (let i = 0; i < 3; i += 1) {
    await act(async () => {
      jest.advanceTimersByTime(500);
    });
  }
}

/** The selected day's page; adjacent days are pre-rendered (UX-02), so queries scope to it. */
const activeDay = () => within(screen.getByTestId('diary-day-list'));

afterEach(() => {
  jest.useRealTimers();
});

/** `+` → Quick calories → Meal Picker → `meal`: the Quick Calories screen opens (NAV-03). */
async function openQuickCalories(meal = 'Lunch') {
  // By test ID: an open Quick Calories screen also has an `Add` button (its primary action).
  await fireEvent.press(screen.getByTestId('tab-add'));
  await fireEvent.press(screen.getByRole('button', { name: 'Quick calories' }));
  await flush();
  const picker = await screen.findByTestId('meal-picker');
  await fireEvent.press(within(picker).getByRole('button', { name: meal }));
  await flush();
  await screen.findByRole('header', { name: 'Quick calories' });
}

async function addQuickCalories(kcal: string, note?: string) {
  await openQuickCalories();
  await fireEvent.changeText(screen.getByLabelText('Calories, kcal'), kcal);
  if (note) await fireEvent.changeText(screen.getByLabelText('Note'), note);
  await fireEvent.press(screen.getByTestId('quick-calories-submit'));
  await flush();
}

describe('NAV-03 / UX-09: + Add Action Sheet', () => {
  it('UX-09: rows are Add food, Scan barcode, Quick calories and Update weight; all enabled', async () => {
    await renderApp('/diary');
    await fireEvent.press(screen.getByRole('button', { name: 'Add' }));
    const sheet = screen.getByTestId('add-action-sheet');
    const rows = within(sheet)
      .getAllByRole('button')
      .map((b) => b.props.accessibilityLabel)
      .filter((label) => label !== 'Close');
    expect(rows).toEqual(['Add food', 'Scan barcode', 'Quick calories', 'Update weight']);
    expect(within(sheet).getByRole('button', { name: 'Add food' })).toBeEnabled();
    expect(within(sheet).getByRole('button', { name: 'Update weight' })).toBeEnabled();
    expect(within(sheet).getByRole('button', { name: 'Quick calories' })).toBeEnabled();
    expect(within(sheet).getByRole('button', { name: 'Scan barcode' })).toBeEnabled();
  });

  it('UX-10: picking an action closes the sheet, then the Meal Picker lists meals in saved order', async () => {
    await renderApp('/diary');
    await fireEvent.press(screen.getByRole('button', { name: 'Add' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Quick calories' }));
    await flush();
    expect(screen.queryByTestId('add-action-sheet')).toBeNull();
    const picker = await screen.findByTestId('meal-picker');
    expect(within(picker).getByRole('header', { name: 'Choose meal' })).toBeOnTheScreen();
    expect(
      within(picker)
        .getAllByRole('button')
        .map((b) => b.props.accessibilityLabel)
        .filter((label) => label !== 'Close'),
    ).toEqual(['Breakfast', 'Lunch', 'Dinner', 'Snacks']);
  });

  it('NAV-04 / UX-04: a meal header + opens Food Search with its meal and date context', async () => {
    const app = await renderApp('/diary');
    await screen.findByTestId('diary-day-list');
    await fireEvent.press(activeDay().getByRole('button', { name: 'Add food to Breakfast' }));
    await flush();
    expect(app.getPathname()).toBe('/diary/food-search');
    expect(await screen.findByRole('header', { name: 'Food search' })).toBeOnTheScreen();
    expect(screen.getByText('Adding to Breakfast · Today')).toBeOnTheScreen();
  });

  it('UX-05/08 / NAV-04: creates a custom food, continues to Food Detail, and adds it to the Diary', async () => {
    const app = await renderApp('/diary');
    await screen.findByTestId('diary-day-list');
    await fireEvent.press(activeDay().getByRole('button', { name: 'Add food to Breakfast' }));
    await flush();
    await fireEvent.changeText(screen.getByTestId('food-search-input'), 'Navigation oats');
    await fireEvent.press(screen.getByRole('button', { name: 'Create custom food' }));
    await flush();
    expect(app.getPathname()).toBe('/diary/create-custom-food');
    expect(screen.getByTestId('custom-food-name').props.value).toBe('Navigation oats');

    await fireEvent.changeText(screen.getByTestId('custom-food-serving'), '100');
    await fireEvent.changeText(screen.getByTestId('custom-food-energy'), '200');
    await fireEvent.changeText(screen.getByTestId('custom-food-protein'), '10');
    await fireEvent.changeText(screen.getByTestId('custom-food-carbohydrate'), '20');
    await fireEvent.changeText(screen.getByTestId('custom-food-fat'), '5');
    await waitFor(() => expect(screen.getByTestId('custom-food-save')).toBeEnabled());
    await fireEvent.press(screen.getByTestId('custom-food-save'));
    await flush();

    expect(app.getPathname()).toMatch(/^\/diary\/food-detail\/.+/);
    expect(await screen.findByText('Navigation oats')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('food-detail-add'));
    await flush();
    // NAV-04: an add returns to Food Search with the query kept and confirms the add; Back then shows the Diary.
    expect(app.getPathname()).toBe('/diary/food-search');
    expect(screen.getByTestId('food-search-input').props.value).toBe('Navigation oats');
    expect(await screen.findByTestId('food-added-toast')).toHaveTextContent('Added Navigation oats to Breakfast');
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    await flush();
    expect(app.getPathname()).toBe('/diary');
    expect(await activeDay().findByRole('header', { name: 'Breakfast, 200 kilocalories' })).toBeOnTheScreen();
  });

  it('NAV-03: cancelling the Meal Picker opens nothing', async () => {
    const app = await renderApp('/diary');
    await fireEvent.press(screen.getByRole('button', { name: 'Add' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Quick calories' }));
    await flush();
    await fireEvent.press(await screen.findByTestId('meal-picker-backdrop'));
    await flush();
    expect(screen.queryByTestId('meal-picker')).toBeNull();
    expect(app.getPathname()).toBe('/diary');
  });

  it('SCOPE-11 flow 2 / NAV-03: Quick Calories → Lunch → 450 kcal → Add ends on the Diary with totals refreshed', async () => {
    const app = await renderApp('/diary');
    await openQuickCalories('Lunch');
    expect(app.getPathname()).toBe('/diary/quick-calories');
    expect(screen.getByLabelText('Meal, Lunch')).toBeOnTheScreen();
    expect(screen.getByTestId('quick-calories-submit')).toBeDisabled();
    expect(screen.getByTestId('quick-calories-submit')).toHaveAccessibleName('Add');

    await fireEvent.changeText(screen.getByLabelText('Calories, kcal'), '450');
    await fireEvent.changeText(screen.getByLabelText('Note'), '  Canteen  ');
    await fireEvent.press(screen.getByTestId('quick-calories-submit'));
    await flush();

    expect(app.getPathname()).toBe('/diary');
    expect(await screen.findByRole('button', { name: /^Canteen, Quick Calories, 450 kilocalories/ })).toBeOnTheScreen();
    expect(activeDay().getByRole('header', { name: 'Lunch, 450 kilocalories' })).toBeOnTheScreen();
    expect(screen.getByLabelText(/Calories remaining, 1,550 of 2,000 kilocalories/)).toBeOnTheScreen();
  });

  it('NAV-03: started from Profile, it uses the selected diary date and ends on the Diary on that date', async () => {
    const app = await renderApp('/diary');
    await fireEvent.press(screen.getByRole('button', { name: 'Next day, Tomorrow' }));
    await fireEvent.press(screen.getByRole('tab', { name: 'Profile' }));
    expect(app.getPathname()).toBe('/profile');

    await openQuickCalories('Dinner');
    await fireEvent.changeText(screen.getByLabelText('Calories, kcal'), '300');
    await fireEvent.press(screen.getByTestId('quick-calories-submit'));
    await flush();

    expect(app.getPathname()).toBe('/diary');
    expect(screen.getByRole('tab', { name: 'Diary' })).toBeSelected();
    expect(await screen.findByLabelText('Showing Tomorrow')).toBeOnTheScreen();
    await screen.findByTestId('diary-day-list');
    expect(activeDay().getByRole('header', { name: 'Dinner, 300 kilocalories' })).toBeOnTheScreen();
  });

  it('NAV-09: cancelling Quick Calories started from Profile returns to Profile', async () => {
    const app = await renderApp('/profile');

    await openQuickCalories('Dinner');
    expect(app.getPathname()).toBe('/diary/quick-calories');
    await fireEvent.changeText(screen.getByLabelText('Calories, kcal'), '300');
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    await flush();

    expect(app.getPathname()).toBe('/profile');
    expect(screen.getByRole('tab', { name: 'Profile' })).toBeSelected();
  });

  it('NAV-03: + over an open Quick Calories screen starts a fresh form for the picked meal', async () => {
    const app = await renderApp('/diary');
    await openQuickCalories('Lunch');
    await fireEvent.changeText(screen.getByLabelText('Calories, kcal'), '450');
    await openQuickCalories('Snacks');
    expect(screen.getByLabelText('Meal, Snacks')).toBeOnTheScreen();
    expect(screen.getByLabelText('Calories, kcal').props.value).toBe('');

    await fireEvent.changeText(screen.getByLabelText('Calories, kcal'), '120');
    await fireEvent.press(screen.getByTestId('quick-calories-submit'));
    await flush();
    expect(app.getPathname()).toBe('/diary');
    await screen.findByTestId('diary-day-list');
    expect(activeDay().getByRole('header', { name: 'Snacks, 120 kilocalories' })).toBeOnTheScreen();
    expect(activeDay().getByRole('header', { name: 'Lunch, 0 kilocalories' })).toBeOnTheScreen();
  });

  it('NAV-04: back from Quick Calories saves nothing', async () => {
    const app = await renderApp('/diary');
    await openQuickCalories();
    await fireEvent.changeText(screen.getByLabelText('Calories, kcal'), '450');
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    await flush();
    expect(app.getPathname()).toBe('/diary');
    await screen.findByTestId('diary-day-list');
    expect(activeDay().getByRole('header', { name: 'Lunch, 0 kilocalories' })).toBeOnTheScreen();
  });
});

describe('UX-07 / NAV-04 / NAV-08: Edit Quick Calories from the Diary', () => {
  it('UX-07: the row opens Edit quick calories with its values; Save stays disabled until something changes', async () => {
    const app = await renderApp('/diary');
    await addQuickCalories('450', 'Canteen');
    await fireEvent.press(await screen.findByRole('button', { name: /^Canteen, Quick Calories/ }));
    await flush();
    expect(app.getPathname()).toMatch(/^\/diary\/quick-calories\/.+/);
    expect(screen.getByRole('header', { name: 'Edit quick calories' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Calories, kcal').props.value).toBe('450');
    expect(screen.getByLabelText('Note').props.value).toBe('Canteen');
    expect(screen.getByRole('button', { name: 'Save', disabled: true })).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Calories, kcal'), '500');
    expect(screen.getByRole('button', { name: 'Save', disabled: false })).toBeOnTheScreen();
  });

  it('NAV-04 / UX-10: change the meal (current one checked) → Save returns to the Diary with the entry moved', async () => {
    const app = await renderApp('/diary');
    await addQuickCalories('450', 'Canteen');
    await fireEvent.press(await screen.findByRole('button', { name: /^Canteen, Quick Calories/ }));
    await flush();

    await fireEvent.press(screen.getByRole('button', { name: 'Meal, Lunch' }));
    await flush();
    const picker = await screen.findByTestId('meal-picker');
    expect(within(picker).getByRole('button', { name: 'Lunch' })).toBeSelected();
    expect(within(picker).getByRole('button', { name: 'Dinner' })).not.toBeSelected();
    await fireEvent.press(within(picker).getByRole('button', { name: 'Dinner' }));
    await flush();
    await fireEvent.changeText(screen.getByLabelText('Calories, kcal'), '520');
    await fireEvent.press(screen.getByRole('button', { name: 'Save', disabled: false }));
    await flush();

    expect(app.getPathname()).toBe('/diary');
    await screen.findByTestId('diary-day-list');
    expect(activeDay().getByRole('header', { name: 'Dinner, 520 kilocalories' })).toBeOnTheScreen();
    expect(activeDay().getByRole('header', { name: 'Lunch, 0 kilocalories' })).toBeOnTheScreen();
  });

  it('NAV-08 / UX-19: Delete entry asks first; Cancel keeps it, Delete entry removes it and returns', async () => {
    const app = await renderApp('/diary');
    await addQuickCalories('450', 'Canteen');
    await fireEvent.press(await screen.findByRole('button', { name: /^Canteen, Quick Calories/ }));
    await flush();

    await fireEvent.press(screen.getByRole('button', { name: 'Delete entry' }));
    const dialog = screen.getByTestId('quick-calories-delete-dialog');
    expect(within(dialog).getByRole('header', { name: 'Delete quick calories?' })).toBeOnTheScreen();
    expect(within(dialog).getByText(/^450 kcal from Lunch on /)).toBeOnTheScreen();
    await fireEvent.press(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByTestId('quick-calories-delete-dialog')).toBeNull();
    expect(app.getPathname()).toMatch(/^\/diary\/quick-calories\/.+/);

    await fireEvent.press(screen.getByRole('button', { name: 'Delete entry' }));
    await fireEvent.press(
      within(screen.getByTestId('quick-calories-delete-dialog')).getByRole('button', { name: 'Delete entry' }),
    );
    await flush();
    expect(app.getPathname()).toBe('/diary');
    await screen.findByTestId('diary-day-list');
    expect(activeDay().getByRole('header', { name: 'Lunch, 0 kilocalories' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /^Canteen, Quick Calories/ })).toBeNull();
  });

  it('UX-00: an unknown entry ID shows "This item no longer exists." with a way back to the Diary', async () => {
    const app = await renderApp('/diary');
    await act(async () => router.push('/diary/quick-calories/does-not-exist'));
    await flush();
    expect(await screen.findByText('This item no longer exists.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Back to Diary' }));
    await flush();
    expect(app.getPathname()).toBe('/diary');
  });

  it('UX-00: invalid Quick Calories params show not found', async () => {
    await renderApp('/diary');
    await act(async () => router.push({ pathname: '/diary/quick-calories', params: { mealId: 'x', date: 'soon' } }));
    await flush();
    expect(await screen.findByText('This item no longer exists.')).toBeOnTheScreen();
  });
});
