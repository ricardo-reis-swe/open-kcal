import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';

import { renderApp } from '@/shared/testing/appRoutes';
import { cameraMock } from '@/shared/testing/expoCameraMock';

// Route tests run the real startup on a fresh seeded SQLite database (meals Breakfast, Lunch, Dinner, Snacks).

async function flush() {
  for (let i = 0; i < 3; i += 1) {
    await act(async () => {
      jest.advanceTimersByTime(500);
    });
  }
}

const activeDay = () => within(screen.getByTestId('diary-day-list'));
// The preview is hidden from accessibility (ARCH-24), so queries must include hidden elements.
const camera = () => screen.getByTestId('barcode-camera', { includeHiddenElements: true });
const scan = (data: string, type = 'ean13') => fireEvent(camera(), 'barcodeScanned', { data, type });

let fetchSpy: jest.SpyInstance;
beforeEach(() => {
  cameraMock.reset();
  // PROV-15: OFF has no product for any code in these tests (`status: 0` / 404 → a miss, not a failure).
  fetchSpy = jest
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async () => new Response(JSON.stringify({ status: 0 }), { status: 404 }));
});
afterEach(() => {
  fetchSpy.mockRestore();
  jest.useRealTimers();
});

describe('NAV-03 / NAV-04 / UX-24: barcode scanning', () => {
  it('scans from Food Search, creates a custom food with the barcode, and finds it on the next scan', async () => {
    const app = await renderApp('/diary');
    await screen.findByTestId('diary-day-list');
    await fireEvent.press(activeDay().getByRole('button', { name: 'Add food to Breakfast' }));
    await flush();
    await fireEvent.press(screen.getByRole('button', { name: 'Scan barcode' }));
    await flush();
    expect(app.getPathname()).toBe('/diary/barcode-scanner');
    await screen.findByTestId('barcode-camera', { includeHiddenElements: true });

    await scan('5601009983178'); // bad check digit: ignored, keeps scanning
    expect(screen.queryByTestId('barcode-looking-up')).toBeNull();
    await scan('5601009983179');
    const notFound = await screen.findByTestId('barcode-not-found');
    expect(within(notFound).getByText('No food found for 5601009983179.')).toBeOnTheScreen();
    expect(within(notFound).getByText('Checked: saved foods, Open Food Facts.')).toBeOnTheScreen();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(String(fetchSpy.mock.calls[0]![0])).toContain('/api/v2/product/5601009983179');

    await fireEvent.press(screen.getByTestId('barcode-create-custom'));
    await flush();
    expect(app.getPathname()).toBe('/diary/create-custom-food');
    expect(screen.getByTestId('custom-food-barcode')).toHaveTextContent(/5601009983179/);
    await fireEvent.changeText(screen.getByTestId('custom-food-name'), 'Iogurte da quinta');
    await fireEvent.changeText(screen.getByTestId('custom-food-serving'), '100');
    await fireEvent.changeText(screen.getByTestId('custom-food-energy'), '120');
    await waitFor(() => expect(screen.getByTestId('custom-food-save')).toBeEnabled());
    await fireEvent.press(screen.getByTestId('custom-food-save'));
    await flush();
    expect(app.getPathname()).toMatch(/^\/diary\/food-detail\/.+/);
    await fireEvent.press(screen.getByTestId('food-detail-add'));
    await flush();
    // NAV-04: the scanner was replaced, so the add lands on Food Search.
    expect(app.getPathname()).toBe('/diary/food-search');

    await fireEvent.press(screen.getByRole('button', { name: 'Scan barcode' }));
    await flush();
    await screen.findByTestId('barcode-camera', { includeHiddenElements: true });
    await scan('5601009983179');
    await flush();
    expect(app.getPathname()).toMatch(/^\/diary\/food-detail\/.+/);
    expect(await screen.findByText('Iogurte da quinta')).toBeOnTheScreen();
    expect(fetchSpy).toHaveBeenCalledTimes(1); // DATA-24: a saved barcode needs no request
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    await flush();
    expect(app.getPathname()).toBe('/diary/food-search');
  });

  it('+ Scan barcode → Meal Picker → scanner over Food Search; Back lands on Food Search', async () => {
    const app = await renderApp('/diary');
    await screen.findByTestId('diary-day-list');
    await fireEvent.press(screen.getByTestId('tab-add'));
    await fireEvent.press(screen.getByRole('button', { name: 'Scan barcode' }));
    await flush();
    const picker = await screen.findByTestId('meal-picker');
    await fireEvent.press(within(picker).getByRole('button', { name: 'Lunch' }));
    await flush();
    expect(app.getPathname()).toBe('/diary/barcode-scanner');
    expect(await screen.findByRole('header', { name: 'Scan barcode' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    await flush();
    expect(app.getPathname()).toBe('/diary/food-search');
    expect(screen.getByText('Adding to Lunch · Today')).toBeOnTheScreen();
  });

  it('UX-08: the New Food form opens the Barcode Scanner from its scan icon', async () => {
    const app = await renderApp(
      '/diary/create-custom-food?mealId=00000000-0000-0000-0000-000000000000&date=2026-01-01',
    );
    await flush();
    expect(screen.getByTestId('custom-food-scan')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('custom-food-scan'));
    await flush();
    expect(app.getPathname()).toBe('/diary/barcode-scanner');
  });

  it('POST-15: Ingredient Search scans a missing product into the recipe as a custom food', async () => {
    const app = await renderApp('/diary');
    await screen.findByTestId('diary-day-list');
    await fireEvent.press(activeDay().getByRole('button', { name: 'Add food to Breakfast' }));
    await flush();
    await fireEvent.press(screen.getByTestId('food-search-tab-recipes'));
    await flush();
    await fireEvent.press(screen.getByRole('button', { name: 'Create recipe' }));
    await flush();
    await fireEvent.changeText(screen.getByTestId('recipe-name'), 'Soup');
    await fireEvent.changeText(screen.getByTestId('recipe-servings'), '2');
    await fireEvent.press(screen.getByTestId('recipe-add-ingredient'));
    // UX-04 ingredient mode (Diary stack): the scan icon is present.
    expect(await screen.findByTestId('food-search-scan')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('food-search-scan'));
    await flush();
    expect(app.getPathname()).toBe('/diary/barcode-scanner');
    await screen.findByTestId('barcode-camera', { includeHiddenElements: true });
    // A code no provider has: not found → Create custom food in ingredient mode.
    await scan('5601009983179');
    await screen.findByTestId('barcode-not-found');
    await fireEvent.press(screen.getByTestId('barcode-create-custom'));
    await flush();
    expect(app.getPathname()).toBe('/diary/create-custom-food');
    expect(screen.getByTestId('custom-food-barcode')).toHaveTextContent(/5601009983179/);
    await fireEvent.changeText(screen.getByTestId('custom-food-name'), 'Carrot');
    await fireEvent.changeText(screen.getByTestId('custom-food-serving'), '100');
    await fireEvent.changeText(screen.getByTestId('custom-food-energy'), '40');
    await waitFor(() => expect(screen.getByTestId('custom-food-save')).toBeEnabled());
    await fireEvent.press(screen.getByTestId('custom-food-save'));
    await flush();
    // Save (ingredient mode) → Ingredient Detail for the draft.
    expect(app.getPathname()).toMatch(/^\/diary\/ingredient-detail\//);
    expect(screen.getByRole('header', { name: 'Add ingredient' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('ingredient-detail-save'));
    await flush();
    // Back on the recipe editor with the scanned food as an ingredient.
    expect(app.getPathname()).toBe('/diary/recipe/new');
    expect(screen.getByText('Carrot')).toBeOnTheScreen();
  });

  it('POST-15: Ingredient Search scans a saved product straight into the recipe', async () => {
    const app = await renderApp('/diary');
    await screen.findByTestId('diary-day-list');
    await fireEvent.press(activeDay().getByRole('button', { name: 'Add food to Breakfast' }));
    await flush();
    // A saved custom food that keeps its barcode (DATA-24), created via the scanner.
    await fireEvent.press(screen.getByTestId('food-search-scan'));
    await flush();
    await screen.findByTestId('barcode-camera', { includeHiddenElements: true });
    await scan('5601009983179');
    await screen.findByTestId('barcode-not-found');
    await fireEvent.press(screen.getByTestId('barcode-create-custom'));
    await flush();
    await fireEvent.changeText(screen.getByTestId('custom-food-name'), 'Carrot');
    await fireEvent.changeText(screen.getByTestId('custom-food-serving'), '100');
    await fireEvent.changeText(screen.getByTestId('custom-food-energy'), '40');
    await waitFor(() => expect(screen.getByTestId('custom-food-save')).toBeEnabled());
    await fireEvent.press(screen.getByTestId('custom-food-save'));
    await flush();
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    await flush();
    // Recipes › Create recipe › Add ingredient › scan the saved barcode → found → Ingredient Detail.
    await fireEvent.press(screen.getByTestId('food-search-tab-recipes'));
    await flush();
    await fireEvent.press(screen.getByRole('button', { name: 'Create recipe' }));
    await flush();
    await fireEvent.changeText(screen.getByTestId('recipe-name'), 'Salad');
    await fireEvent.changeText(screen.getByTestId('recipe-servings'), '1');
    await fireEvent.press(screen.getByTestId('recipe-add-ingredient'));
    await flush();
    await fireEvent.press(screen.getByTestId('food-search-scan'));
    await flush();
    expect(app.getPathname()).toBe('/diary/barcode-scanner');
    await screen.findByTestId('barcode-camera', { includeHiddenElements: true });
    await scan('5601009983179');
    await flush();
    expect(app.getPathname()).toMatch(/^\/diary\/ingredient-detail\//);
    expect(screen.getByRole('header', { name: 'Add ingredient' })).toBeOnTheScreen();
    expect(screen.getByText('Carrot')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('ingredient-detail-save'));
    await flush();
    expect(app.getPathname()).toBe('/diary/recipe/new');
    expect(screen.getByText('Carrot')).toBeOnTheScreen();
  });
});
