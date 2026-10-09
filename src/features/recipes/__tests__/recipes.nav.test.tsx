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

/** Food Search › My foods → Create custom food (per 100 g) → Save → Food Detail → Back to Food Search. */
async function createCustomFood(name: string, kcal: string) {
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
}

/** Recipes tab → Create recipe → name + servings → Add ingredient → My foods → the ingredient's detail. */
async function startRecipe(name: string, servings: string, ingredient: string) {
  await fireEvent.press(screen.getByTestId('food-search-tab-recipes'));
  await flush();
  await fireEvent.press(screen.getByRole('button', { name: 'Create recipe' }));
  await flush();
  await fireEvent.changeText(screen.getByTestId('recipe-name'), name);
  await fireEvent.changeText(screen.getByTestId('recipe-servings'), servings);
  await fireEvent.press(screen.getByTestId('recipe-add-ingredient'));
  await flush();
  await fireEvent.press(screen.getByTestId('food-search-tab-custom'));
  await flush();
  await fireEvent.press(await screen.findByText(ingredient));
  await flush();
}

describe('SCOPE-13 / UX-26: recipes', () => {
  it('creates a recipe from ingredients, logs it, and shows it on All only while it is recent', async () => {
    const app = await renderApp('/diary');
    await screen.findByTestId('diary-day-list');
    await fireEvent.press(activeDay().getByRole('button', { name: 'Add food to Breakfast' }));
    await flush();
    await createCustomFood('Rice', '360');

    await startRecipe('Rice bowl', '2', 'Rice');
    // UX-05 ingredient mode: no Meal or Date rows; Add writes the draft only.
    expect(app.getPathname()).toMatch(/^\/diary\/ingredient-detail\//);
    expect(screen.getByRole('header', { name: 'Add ingredient' })).toBeOnTheScreen();
    expect(screen.queryByText('Meal')).toBeNull();
    await fireEvent.press(screen.getByTestId('ingredient-detail-save'));
    await flush();
    expect(app.getPathname()).toBe('/diary/recipe/new');
    expect(screen.getByText('Rice')).toBeOnTheScreen();
    expect(screen.getByTestId('recipe-per-serving')).toHaveTextContent('180 kcal');
    expect(screen.getByTestId('recipe-whole')).toHaveTextContent(/360 kcal/);
    // DATA-27: the raw weight per serving comes from the ingredients (100 g ÷ 2).
    expect(screen.getByTestId('recipe-raw').props.value).toBe('50');

    await waitFor(() => expect(screen.getByTestId('recipe-save')).toBeEnabled());
    await fireEvent.press(screen.getByTestId('recipe-save'));
    await flush();
    // NAV-04: Save → Food Detail for the recipe (nothing logged yet).
    expect(app.getPathname()).toMatch(/^\/diary\/food-detail\//);
    expect(screen.getByText('Recipe · per serving')).toBeOnTheScreen();
    expect(screen.getByText('g raw')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('food-detail-add'));
    await flush();

    // A second recipe that is never logged.
    await startRecipe('Rice salad', '1', 'Rice');
    await fireEvent.press(screen.getByTestId('ingredient-detail-save'));
    await flush();
    await fireEvent.press(screen.getByTestId('recipe-save'));
    await flush();
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    await flush();

    // Recipes tab: both. All with a query: only the recent one (UX-04, user decision 2026-10-01).
    await fireEvent.press(screen.getByTestId('food-search-tab-recipes'));
    await flush();
    expect(screen.getByText('Rice bowl')).toBeOnTheScreen();
    expect(screen.getByText('Rice salad')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('food-search-tab-all'));
    await fireEvent.changeText(screen.getByTestId('food-search-input'), 'Ri');
    await flush();
    expect(screen.getByText('Rice bowl')).toBeOnTheScreen();
    expect(screen.queryByText('Rice salad')).toBeNull();
  });

  it('Profile › My recipes opens the editor; Save edits the recipe (DATA-28)', async () => {
    const app = await renderApp('/diary');
    await screen.findByTestId('diary-day-list');
    await fireEvent.press(activeDay().getByRole('button', { name: 'Add food to Breakfast' }));
    await flush();
    await createCustomFood('Oats', '400');
    await startRecipe('Porridge', '2', 'Oats');
    await fireEvent.press(screen.getByTestId('ingredient-detail-save'));
    await flush();
    await fireEvent.press(screen.getByTestId('recipe-save'));
    await flush();
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    await flush();
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    await flush();

    await fireEvent.press(screen.getByRole('tab', { name: 'Profile' }));
    await flush();
    expect(await screen.findByText('1 recipe')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('profile-my-recipes'));
    await flush();
    expect(app.getPathname()).toBe('/profile/my-recipes');
    await fireEvent.press(await screen.findByText('Porridge'));
    await flush();
    expect(await screen.findByRole('header', { name: 'Edit recipe' })).toBeOnTheScreen();
    expect(screen.getByTestId('recipe-save')).toBeDisabled(); // UX-00: nothing changed yet
    expect(screen.getByText('Oats')).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByTestId('recipe-servings'), '4');
    await waitFor(() => expect(screen.getByTestId('recipe-save')).toBeEnabled());
    await fireEvent.press(screen.getByTestId('recipe-save'));
    await flush();
    expect(app.getPathname()).toBe('/profile/my-recipes');
    expect(await screen.findByText('100')).toBeOnTheScreen(); // 400 kcal ÷ 4 servings
  });
});
