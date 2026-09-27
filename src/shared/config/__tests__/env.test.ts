import { ConfigError, getConfig, parseConfig, type RawEnv } from '../env';

const valid: RawEnv = {
  EXPO_PUBLIC_USDA_BASE_URL: 'https://api.nal.usda.gov/fdc/v1/',
  EXPO_PUBLIC_OFF_SEARCH_BASE_URL: 'https://search.openfoodfacts.org',
  EXPO_PUBLIC_OFF_PRODUCT_BASE_URL: 'https://world.openfoodfacts.org',
  EXPO_PUBLIC_OFF_CONTACT_EMAIL: 'ricardo_reis@live.com',
};

describe('ARCH-14: typed public config', () => {
  it('parses valid env and strips trailing slashes from base URLs', () => {
    expect(parseConfig(valid, '1.2.3')).toEqual({
      appVersion: '1.2.3',
      usdaBaseUrl: 'https://api.nal.usda.gov/fdc/v1',
      offSearchBaseUrl: 'https://search.openfoodfacts.org',
      offProductBaseUrl: 'https://world.openfoodfacts.org',
      offContactEmail: 'ricardo_reis@live.com',
      devSeedDiary: false,
      devSeedFoodSearch: false,
    });
  });

  it('rejects missing and invalid values, naming keys but never values', () => {
    const env: RawEnv = {
      ...valid,
      EXPO_PUBLIC_USDA_BASE_URL: undefined,
      EXPO_PUBLIC_OFF_SEARCH_BASE_URL: 'http://insecure.example',
      EXPO_PUBLIC_OFF_CONTACT_EMAIL: 'not-an-email',
    };
    let error: unknown;
    try {
      parseConfig(env, '1.0.0');
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(ConfigError);
    const configError = error as ConfigError;
    expect([...configError.invalidKeys].sort()).toEqual([
      'EXPO_PUBLIC_OFF_CONTACT_EMAIL',
      'EXPO_PUBLIC_OFF_SEARCH_BASE_URL',
      'EXPO_PUBLIC_USDA_BASE_URL',
    ]);
    expect(configError.message).not.toContain('insecure.example');
    expect(configError.message).not.toContain('not-an-email');
  });

  it('loads the committed .env.example values in tests', () => {
    expect(getConfig().offContactEmail).toBe('ricardo_reis@live.com');
  });
});
