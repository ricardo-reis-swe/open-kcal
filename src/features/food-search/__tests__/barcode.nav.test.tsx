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
});
