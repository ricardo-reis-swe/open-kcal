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
  return { credentials, searchSpy, onBack, value: () => stored };
}

afterEach(async () => {
  await cleanup();
  onlineManager.setOnline(true);
  jest.restoreAllMocks();
});

describe('UX-18 / UX-19: Food Databases', () => {
  it('uses secure input, masks a saved key, and returns with the app-bar back action', async () => {
    const { onBack } = await setup({ key: 'abcd1234' });
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
    await fireEvent.press(await screen.findByRole('button', { name: 'Add key' }));
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
    await fireEvent.press(await screen.findByRole('button', { name: 'Replace key' }));
    searchSpy.mockRejectedValueOnce(new ProviderConfigurationError('rejected'));
    await fireEvent.changeText(screen.getByTestId('usda-key-input'), 'new-key');
    await fireEvent.press(screen.getByTestId('usda-save-key'));
    expect(await screen.findByText('USDA rejected this key.')).toBeTruthy();
    expect(value()).toBe('old-key');

    await fireEvent.press(screen.getByRole('button', { name: 'Save key' }));
    await waitFor(() => expect(value()).toBe('new-key'));
    expect(await screen.findByText('••••-key')).toBeTruthy();
  });

  it('PROV-11: Test key reports active/rejected/rate limited and preserves status on reachability failure', async () => {
    const { searchSpy } = await setup({ key: 'saved-key' });
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

    searchSpy.mockRejectedValueOnce(new ProviderConfigurationError('rejected'));
    await fireEvent.press(screen.getByRole('button', { name: 'Test key' }));
    expect(await screen.findByText('USDA rejected this key.')).toBeTruthy();
    expect(screen.getByText('Key rejected')).toBeTruthy();
  });

  it('UX-18 / NAV-08: disables Test key offline and removes the key only after confirmation', async () => {
    onlineManager.setOnline(false);
    const { value } = await setup({ key: 'saved-key' });
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
