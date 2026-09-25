import { createCredentialsService } from '../credentialsService';

const KEY = 'abcDEF123secret3f9a';

function memoryStore() {
  const items = new Map<string, string>();
  return {
    items,
    getItemAsync: jest.fn(async (k: string) => items.get(k) ?? null),
    setItemAsync: jest.fn(async (k: string, v: string) => void items.set(k, v)),
    deleteItemAsync: jest.fn(async (k: string) => void items.delete(k)),
  };
}

describe('ARCH-10 / DATA-01: CredentialsService', () => {
  it('saves, reads per request, masks and removes the USDA key', async () => {
    const store = memoryStore();
    const credentials = createCredentialsService(store);
    expect(await credentials.hasUsdaApiKey()).toBe(false);
    await credentials.saveUsdaApiKey(`  ${KEY}  `);
    expect(await credentials.hasUsdaApiKey()).toBe(true);
    expect(await credentials.getUsdaApiKeyForRequest()).toBe(KEY);
    expect(await credentials.getUsdaApiKeyHint()).toBe('••••3f9a');
    await credentials.removeUsdaApiKey();
    expect(await credentials.getUsdaApiKeyForRequest()).toBeNull();
    expect(store.items.size).toBe(0);
  });

  it('stores device-only in the keychain', async () => {
    const store = memoryStore();
    await createCredentialsService(store).saveUsdaApiKey(KEY);
    expect(store.setItemAsync).toHaveBeenCalledWith('usda_api_key', KEY, {
      keychainAccessible: expect.anything(),
    });
  });

  it('rejects a blank key and treats a blank stored value as missing (ARCH-03)', async () => {
    const store = memoryStore();
    const credentials = createCredentialsService(store);
    await expect(credentials.saveUsdaApiKey('   ')).rejects.toMatchObject({ category: 'validation' });
    store.items.set('usda_api_key', '  ');
    expect(await credentials.hasUsdaApiKey()).toBe(false);
  });

  it('maps storage failures to SecureStorageError without leaking the key', async () => {
    const store = memoryStore();
    store.setItemAsync.mockRejectedValueOnce(new Error(`keychain refused ${KEY}`));
    store.getItemAsync.mockRejectedValueOnce(new Error(`read failed ${KEY}`));
    const credentials = createCredentialsService(store);
    const write = await credentials.saveUsdaApiKey(KEY).catch((e: unknown) => e);
    const read = await credentials.getUsdaApiKeyForRequest().catch((e: unknown) => e);
    for (const error of [write, read]) {
      expect(error).toMatchObject({ category: 'secure_storage' });
      expect(JSON.stringify(error)).not.toContain(KEY);
      expect(String((error as Error).message)).not.toContain(KEY);
      expect((error as Error).cause).toBeUndefined();
    }
  });
});
