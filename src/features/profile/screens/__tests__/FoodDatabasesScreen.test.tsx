import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { onlineManager } from '@tanstack/react-query';

import { UsdaClient } from '@/data/api/usda/client';
import type { CredentialsService } from '@/data/secure-storage/credentialsService';
import { ProviderConfigurationError, RateLimitError } from '@/shared/errors';
import { createTestServices, renderWithServices } from '@/shared/testing/services';

import { FoodDatabasesScreen } from '../FoodDatabasesScreen';

async function setup(options: { key?: string | null } = {}) {
  let stored = options.key ?? null;
  const credentials: CredentialsService = {
    hasUsdaApiKey: async () => stored !== null,
    getUsdaApiKeyForRequest: async () => stored,
    saveUsdaApiKey: async (value) => {
      stored = value;
    },
    removeUsdaApiKey: async () => {
      stored = null;
    },
    getUsdaApiKeyHint: async () => (stored ? `••••${stored.slice(-4)}` : null),
  };
  const { services } = await createTestServices();
  services.credentials = credentials;
  const searchSpy = jest
    .spyOn(UsdaClient.prototype, 'search')
    .mockResolvedValue({ candidates: [], page: 1, pageCount: 1 });
  const onBack = jest.fn();
  await renderWithServices(<FoodDatabasesScreen onBack={onBack} />, services);
  return { credentials, searchSpy, onBack, services, value: () => stored };
}

afterEach(async () => {
  await cleanup();
  onlineManager.setOnline(true);
  jest.restoreAllMocks();
});

describe('UX-18 / UX-19: Food Databases', () => {
  it('uses secure input, masks a saved key, and returns with the app-bar back action', async () => {
    const { onBack } = await setup({ key: 'abcd1234' });
    await screen.findByText('Saved · will check when online');
    await fireEvent.press(screen.getByTestId('usda-status'));
    expect(await screen.findByText('••••1234')).toBeTruthy();
    expect(screen.queryByText('abcd1234')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Back'));
    expect(onBack).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByRole('button', { name: 'Replace key' }));
    const input = await screen.findByTestId('usda-key-input');
    expect(input.props.secureTextEntry).toBe(true);
    expect(input.props.autoCorrect).toBe(false);
    expect(input.props.autoCapitalize).toBe('none');
  });

  it('PROV-11: validates blank, whitespace, and DEMO_KEY locally without sending or saving them', async () => {
    const { searchSpy, value } = await setup();
    await fireEvent.press(await screen.findByTestId('usda-status'));
    for (const candidate of ['', 'has spaces', 'DEMO_KEY']) {
      await fireEvent.changeText(screen.getByTestId('usda-key-input'), candidate);
      await fireEvent.press(screen.getByTestId('usda-save-key'));
      await waitFor(() =>
        expect(screen.getByText(candidate === 'DEMO_KEY' ? /Use your own key/ : /without spaces/)).toBeTruthy(),
      );
    }
    expect(searchSpy).not.toHaveBeenCalled();
    expect(value()).toBeNull();
  });

  it('PROV-11: keeps an old key on a rejected replacement, saves only a successful replacement, and never puts it in the URL', async () => {
    const { searchSpy, value } = await setup({ key: 'old-key' });
    await screen.findByText('Saved · will check when online');
    await fireEvent.press(await screen.findByTestId('usda-status'));
    await fireEvent.press(await screen.findByRole('button', { name: 'Replace key' }));
    searchSpy.mockRejectedValueOnce(new ProviderConfigurationError('rejected', 'usda_key_rejected'));
    await fireEvent.changeText(screen.getByTestId('usda-key-input'), 'new-key');
    await fireEvent.press(screen.getByTestId('usda-save-key'));
    expect(await screen.findByText('USDA rejected this key.')).toBeTruthy();
    expect(value()).toBe('old-key');

    await fireEvent.press(screen.getByRole('button', { name: 'Save key' }));
    await waitFor(() => expect(value()).toBe('new-key'));
    expect(screen.queryByTestId('usda-options')).toBeNull();
    expect(screen.getByTestId('usda-status').props.accessibilityState.expanded).toBe(false);
  });

  it('PROV-11: Test key reports active/rejected/rate limited and preserves status on reachability failure', async () => {
    const { searchSpy } = await setup({ key: 'saved-key' });
    await screen.findByText('Saved · will check when online');
    await fireEvent.press(await screen.findByTestId('usda-status'));
    await screen.findByText('••••-key');
    await fireEvent.press(screen.getByRole('button', { name: 'Test key' }));
    expect(await screen.findByText('Key works.')).toBeTruthy();
    expect(screen.getByText('Active')).toBeTruthy();

    searchSpy.mockRejectedValueOnce(new RateLimitError('rate limited'));
    await fireEvent.press(screen.getByRole('button', { name: 'Test key' }));
    expect(await screen.findByText("Key works, but it's over its hourly limit right now.")).toBeTruthy();
    expect(screen.getByText('Active')).toBeTruthy();

    searchSpy.mockRejectedValueOnce(new Error('offline'));
    await fireEvent.press(screen.getByRole('button', { name: 'Test key' }));
    expect(await screen.findByText("Couldn't reach USDA. Try again.")).toBeTruthy();
    expect(screen.getByText('Active')).toBeTruthy();

    searchSpy.mockRejectedValueOnce(new ProviderConfigurationError('rejected', 'usda_key_rejected'));
    await fireEvent.press(screen.getByRole('button', { name: 'Test key' }));
    expect(await screen.findByText('USDA rejected this key.')).toBeTruthy();
    expect(screen.getByText('Key rejected')).toBeTruthy();
  });

  it('UX-18 / NAV-08: disables Test key offline and removes the key only after confirmation', async () => {
    onlineManager.setOnline(false);
    const { value } = await setup({ key: 'saved-key' });
    await screen.findByText('Saved · will check when online');
    await fireEvent.press(await screen.findByTestId('usda-status'));
    expect(await screen.findByText('Connect to the internet to test.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Test key' }).props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(screen.getByRole('button', { name: 'Remove key' }));
    expect(await screen.findByText('Remove USDA API key?')).toBeTruthy();
    expect(screen.getByText('USDA search will stop. Saved foods stay.')).toBeTruthy();
    await fireEvent.press(screen.getAllByRole('button', { name: 'Remove key' }).at(-1)!);
    await waitFor(() => expect(value()).toBeNull());
    expect(await screen.findByText('Not set up')).toBeTruthy();
  });
});

describe('UX-18 `Search results` (DATA-19)', () => {
  const order = async (services: Awaited<ReturnType<typeof setup>>['services']) =>
    (await services.settings.getFoodSearchSections()).map((s) => `${s.id}:${s.visible ? 'on' : 'off'}`);

  it('lists the 4 sections in the default order and keeps USDA unavailable without a key', async () => {
    await setup();
    expect(await screen.findByText('Search results')).toBeTruthy();
    for (const id of ['custom', 'saved', 'open_food_facts']) {
      expect(screen.getByTestId(`search-section-switch-${id}`).props.value).toBe(true);
    }
    expect(screen.getByTestId('search-section-switch-usda').props.value).toBe(false);
    expect(screen.getByTestId('search-section-switch-usda').props.disabled).toBe(true);
  });

  it('allows USDA results to be enabled once a key is configured', async () => {
    await setup({ key: 'saved-key' });
    await screen.findByText('Saved · will check when online');
    expect(screen.getByTestId('search-section-switch-usda').props.value).toBe(true);
    expect(screen.getByTestId('search-section-switch-usda').props.disabled).toBe(false);
  });

  it('saves a switch change immediately', async () => {
    const { services } = await setup();
    await fireEvent(await screen.findByTestId('search-section-switch-usda'), 'valueChange', false);
    await waitFor(async () =>
      expect(await order(services)).toEqual(['custom:on', 'saved:on', 'open_food_facts:on', 'usda:off']),
    );
  });

  it('reorders with the Move down accessibility action and saves', async () => {
    const { services } = await setup();
    await fireEvent(await screen.findByTestId('search-section-row-custom'), 'accessibilityAction', {
      nativeEvent: { actionName: 'moveDown' },
    });
    await waitFor(async () =>
      expect(await order(services)).toEqual(['saved:on', 'custom:on', 'open_food_facts:on', 'usda:on']),
    );
  });

  it('disables the last visible switch with the helper text', async () => {
    const { services } = await setup();
    await services.settings.setFoodSearchSections([
      { id: 'custom', visible: false },
      { id: 'saved', visible: false },
      { id: 'open_food_facts', visible: true },
      { id: 'usda', visible: false },
    ]);
    await cleanup();
    await renderWithServices(<FoodDatabasesScreen onBack={jest.fn()} />, services);
    const last = await screen.findByTestId('search-section-switch-open_food_facts');
    expect(last.props.disabled).toBe(true);
    expect(screen.getByText('At least one section must be shown.')).toBeTruthy();
    expect(screen.getByTestId('search-section-switch-usda').props.disabled).toBe(true);
  });
});
