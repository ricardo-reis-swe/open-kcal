import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';

import { createQueryClient } from '@/bootstrap/query-client';
import { createServices, ServicesProvider, type AppServices } from '@/bootstrap/services';
import type { CredentialsService } from '@/data/secure-storage/credentialsService';

import { renderWithProviders, type ProviderOptions } from './render';
import { openSeededTestDatabase, testClock } from './testDb';

const TEST_CONFIG = {
  appVersion: '0.0.0-test',
  usdaBaseUrl: 'https://api.nal.usda.gov/fdc/v1',
  offSearchBaseUrl: 'https://search.openfoodfacts.org',
  offProductBaseUrl: 'https://world.openfoodfacts.org',
  offContactEmail: 'ricardo_reis@live.com',
  devSeedDiary: false,
  devSeedFoodSearch: false,
};

const noCredentials: CredentialsService = {
  hasUsdaApiKey: async () => false,
  getUsdaApiKeyForRequest: async () => null,
  saveUsdaApiKey: async () => undefined,
  removeUsdaApiKey: async () => undefined,
  getUsdaApiKeyHint: async () => null,
};

// Query clients keep garbage-collection timers alive, which kept Jest from exiting; clear them after each test.
const clients: ReturnType<typeof createQueryClient>[] = [];
afterEach(() => {
  for (const client of clients.splice(0)) client.clear();
});

/** App services over a seeded real-SQLite database (ARCH-18), with a settable clock. */
export async function createTestServices(options: { now?: string } = {}) {
  const clock = testClock(options.now ?? '2026-09-25T10:00:00.000Z');
  const deps = await openSeededTestDatabase({ clock });
  const services = createServices({ ...deps, config: TEST_CONFIG, credentials: noCredentials });
  return { services, clock };
}

/** Renders a screen with theme/i18n + services + a fresh query client. */
export function renderWithServices(ui: ReactElement, services: AppServices, options: ProviderOptions = {}) {
  const client = createQueryClient();
  // Finished mutations keep a 5-minute cleanup timer that `clear()` doesn't cancel; drop them at once in tests.
  const defaults = client.getDefaultOptions();
  client.setDefaultOptions({ ...defaults, mutations: { ...defaults.mutations, gcTime: 0 } });
  clients.push(client);
  return renderWithProviders(
    <ServicesProvider services={services}>
      <QueryClientProvider client={client}>{ui}</QueryClientProvider>
    </ServicesProvider>,
    options,
  );
}
