// The only module that touches the USDA API key (ARCH-10, DATA-01). Keychain/Keystore via expo-secure-store.
// The key never goes to SQLite, logs, errors, query keys or state snapshots; errors here never include it.
import * as SecureStore from 'expo-secure-store';
import { z } from 'zod';

import { SecureStorageError, ValidationError } from '@/shared/errors';

const USDA_KEY = 'usda_api_key';
// Device-only: not restored to another device from a backup; readable while the app is in use.
const OPTIONS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

// ARCH-03: validate what comes back from secure storage.
const storedKey = z.string().trim().min(1);

export interface CredentialsService {
  hasUsdaApiKey(): Promise<boolean>;
  /** Read per request (ARCH-11); callers must not keep it. `null` when no key is saved. */
  getUsdaApiKeyForRequest(): Promise<string | null>;
  saveUsdaApiKey(value: string): Promise<void>;
  removeUsdaApiKey(): Promise<void>;
  /** Masked hint for Food Databases, e.g. `••••3f9a` (UX-18). */
  getUsdaApiKeyHint(): Promise<string | null>;
}

async function guarded<T>(operation: string, task: () => Promise<T>): Promise<T> {
  try {
    return await task();
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    // Don't attach the native error as cause: platform messages can echo the stored value.
    throw new SecureStorageError(`Secure storage ${operation} failed`);
  }
}

export function createCredentialsService(
  store: Pick<typeof SecureStore, 'getItemAsync' | 'setItemAsync' | 'deleteItemAsync'> = SecureStore,
): CredentialsService {
  const read = () =>
    guarded('read', async () => {
      const parsed = storedKey.safeParse(await store.getItemAsync(USDA_KEY, OPTIONS));
      return parsed.success ? parsed.data : null;
    });

  return {
    hasUsdaApiKey: async () => (await read()) !== null,
    getUsdaApiKeyForRequest: read,
    async saveUsdaApiKey(value) {
      const parsed = storedKey.safeParse(value);
      if (!parsed.success) throw new ValidationError('USDA API key is required', ['usdaApiKey']);
      await guarded('write', () => store.setItemAsync(USDA_KEY, parsed.data, OPTIONS));
    },
    removeUsdaApiKey: () => guarded('delete', () => store.deleteItemAsync(USDA_KEY, OPTIONS)),
    async getUsdaApiKeyHint() {
      const key = await read();
      return key === null ? null : `••••${key.slice(-4)}`;
    },
  };
}
