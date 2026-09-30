import { onlineManager } from '@tanstack/react-query';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { DEFAULT_FOOD_SEARCH_SECTIONS, type FoodSearchSections } from '@/domain/food/searchSections';
import { ProviderResponseError } from '@/shared/errors';
import { BLOCKED, cameraMock, UNDETERMINED } from '@/shared/testing/expoCameraMock';
import { createTestServices, renderWithServices } from '@/shared/testing/services';

import { BarcodeScannerScreen } from '../screens/BarcodeScannerScreen';

const camera = () => screen.getByTestId('barcode-camera', { includeHiddenElements: true });

async function setup({
  usdaKey = false,
  language,
  sections,
}: { usdaKey?: boolean; language?: 'en' | 'pt-PT'; sections?: FoodSearchSections } = {}) {
  const { services } = await createTestServices();
  if (sections) await services.settings.setFoodSearchSections(sections);
  jest.spyOn(services.credentials, 'hasUsdaApiKey').mockResolvedValue(usdaKey);
  const off = jest.spyOn(services.openFoodFacts, 'findBarcode').mockResolvedValue(null);
  const usda = jest.spyOn(services.usda, 'findBarcode').mockResolvedValue(null);
  const onFound = jest.fn();
  const onCreateCustom = jest.fn();
  await renderWithServices(
    <BarcodeScannerScreen onBack={jest.fn()} onFound={onFound} onCreateCustom={onCreateCustom} />,
    services,
    { language },
  );
  return { services, off, usda, onFound, onCreateCustom };
}

beforeEach(() => cameraMock.reset());
afterEach(async () => {
  await cleanup();
  onlineManager.setOnline(true);
  jest.restoreAllMocks();
});

describe('UX-24 Barcode Scanner', () => {
  it('asks for camera permission on open, once', async () => {
    cameraMock.permission = UNDETERMINED;
    await setup();
    await waitFor(() => expect(cameraMock.requests).toBe(1));
    expect(await screen.findByTestId('barcode-camera', { includeHiddenElements: true })).toBeTruthy();
    expect(cameraMock.requests).toBe(1);
  });

  it('a blocked permission explains, offers Open settings and manual entry', async () => {
    cameraMock.permission = BLOCKED;
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
    await setup();
    expect(await screen.findByText('Allow camera access to scan barcodes.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Open settings' }));
    expect(openSettings).toHaveBeenCalled();
    expect(screen.getByTestId('barcode-manual-input')).toBeOnTheScreen();
    expect(cameraMock.requests).toBe(0);
  });

  it('a camera that fails to mount shows Camera unavailable and the manual field; an invalid code is a field error', async () => {
    const { off } = await setup();
    // The camera is shown first (native has no availability query); a mount error switches to unavailable.
    await screen.findByTestId('barcode-camera', { includeHiddenElements: true });
    expect(screen.getByText('Point the camera at a barcode.')).toBeOnTheScreen();
    await fireEvent(camera(), 'mountError', { message: 'Camera is not available' });
    expect(await screen.findByText('Camera unavailable.')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByTestId('barcode-manual-input'), '1234');
    await fireEvent.press(screen.getByTestId('barcode-look-up'));
    expect(screen.getByText('Enter a valid barcode (8–14 digits).')).toBeOnTheScreen();
    expect(off).not.toHaveBeenCalled();
    await fireEvent.changeText(screen.getByTestId('barcode-manual-input'), '5601009983179');
    await fireEvent.press(screen.getByTestId('barcode-look-up'));
    expect(await screen.findByText('No food found for 5601009983179.')).toBeOnTheScreen();
  });

  it('opens a found food and reads a UPC-E as its UPC-A', async () => {
    const { services, onFound } = await setup();
    const food = await services.foods.createCustom({
      name: 'Imported crackers',
      brand: null,
      basisQuantity: 100,
      basisUnit: 'g',
      nutrients: { energyKcal: 450, carbohydrateG: 70, proteinG: 9, fatG: 14 },
      servings: [{ label: 'g', quantity: 1, unit: 'g', basisMultiplier: 0.01 }],
      barcode: '00042100005264',
    });
    await screen.findByTestId('barcode-camera', { includeHiddenElements: true });
    await fireEvent(camera(), 'barcodeScanned', { data: '04252614', type: 'upc_e' });
    await waitFor(() => expect(onFound).toHaveBeenCalledWith(expect.objectContaining({ id: food.id })));
  });

  it('not found lists what was checked, notes hidden providers, and offers Create custom food + Scan again', async () => {
    const { off, usda, onCreateCustom } = await setup({
      usdaKey: true,
      sections: DEFAULT_FOOD_SEARCH_SECTIONS.map((section) => ({ ...section, visible: section.id !== 'usda' })),
    });
    await screen.findByTestId('barcode-camera', { includeHiddenElements: true });
    await fireEvent(camera(), 'barcodeScanned', { data: '5601009983179', type: 'ean13' });
    expect(await screen.findByText('Checked: saved foods, Open Food Facts.')).toBeOnTheScreen();
    expect(screen.getByText('USDA is turned off in Food Databases.')).toBeOnTheScreen();
    expect(off).toHaveBeenCalledWith('5601009983179', expect.any(AbortSignal));
    expect(usda).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('barcode-create-custom'));
    expect(onCreateCustom).toHaveBeenCalledWith('05601009983179');
    await fireEvent.press(screen.getByTestId('barcode-scan-again'));
    expect(screen.getByText('Point the camera at a barcode.')).toBeOnTheScreen();
  });

  it('offline: only saved foods are checked, no request', async () => {
    onlineManager.setOnline(false);
    const { off } = await setup();
    await screen.findByTestId('barcode-camera', { includeHiddenElements: true });
    await fireEvent(camera(), 'barcodeScanned', { data: '5601009983179', type: 'ean13' });
    expect(await screen.findByText('Offline. Only saved foods were checked.')).toBeOnTheScreen();
    expect(screen.getByText('Checked: saved foods.')).toBeOnTheScreen();
    expect(off).not.toHaveBeenCalled();
  });

  it('a failing provider shows Couldn’t check + Retry, which runs the lookup again', async () => {
    const { off } = await setup();
    off.mockRejectedValue(new ProviderResponseError('down'));
    await screen.findByTestId('barcode-camera', { includeHiddenElements: true });
    await fireEvent(camera(), 'barcodeScanned', { data: '5601009983179', type: 'ean13' });
    expect(await screen.findByText("Couldn't check Open Food Facts.")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(off).toHaveBeenCalledTimes(2));
  });

  it('renders in pt-PT', async () => {
    await setup({ language: 'pt-PT' });
    await screen.findByTestId('barcode-camera', { includeHiddenElements: true });
    await fireEvent(camera(), 'mountError', { message: 'Camera is not available' });
    expect(await screen.findByText('Câmara indisponível.')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Ler código de barras' })).toBeOnTheScreen();
  });
});
