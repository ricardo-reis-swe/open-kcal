import Constants from 'expo-constants';
import { z } from 'zod';

// Typed public config (ARCH-14). The only module that reads `process.env`; features import `getConfig()`.
// Treat every value as public: it ships in the bundle.

const httpsUrl = z.url({ protocol: /^https$/ }).transform((value) => value.replace(/\/+$/, ''));

const envSchema = z.object({
  EXPO_PUBLIC_USDA_BASE_URL: httpsUrl,
  EXPO_PUBLIC_OFF_SEARCH_BASE_URL: httpsUrl,
  EXPO_PUBLIC_OFF_PRODUCT_BASE_URL: httpsUrl,
  EXPO_PUBLIC_OFF_CONTACT_EMAIL: z.email(),
});

export type RawEnv = Partial<Record<keyof z.input<typeof envSchema>, string | undefined>>;

export type AppConfig = {
  appVersion: string;
  usdaBaseUrl: string;
  offSearchBaseUrl: string;
  offProductBaseUrl: string;
  offContactEmail: string;
};

export class ConfigError extends Error {
  override readonly name = 'ConfigError';
  /** Names of the invalid or missing variables. Never their values. */
  readonly invalidKeys: readonly string[];

  constructor(invalidKeys: readonly string[]) {
    super(`Invalid app config: ${invalidKeys.join(', ')}`);
    this.invalidKeys = invalidKeys;
  }
}

export function parseConfig(env: RawEnv, appVersion: string): AppConfig {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    const keys = [...new Set(result.error.issues.map((issue) => String(issue.path[0])))];
    throw new ConfigError(keys);
  }
  const value = result.data;
  return {
    appVersion,
    usdaBaseUrl: value.EXPO_PUBLIC_USDA_BASE_URL,
    offSearchBaseUrl: value.EXPO_PUBLIC_OFF_SEARCH_BASE_URL,
    offProductBaseUrl: value.EXPO_PUBLIC_OFF_PRODUCT_BASE_URL,
    offContactEmail: value.EXPO_PUBLIC_OFF_CONTACT_EMAIL,
  };
}

// Expo inlines `process.env.EXPO_PUBLIC_*` only for static member access, so each key is read explicitly.
function readProcessEnv(): RawEnv {
  return {
    EXPO_PUBLIC_USDA_BASE_URL: process.env.EXPO_PUBLIC_USDA_BASE_URL,
    EXPO_PUBLIC_OFF_SEARCH_BASE_URL: process.env.EXPO_PUBLIC_OFF_SEARCH_BASE_URL,
    EXPO_PUBLIC_OFF_PRODUCT_BASE_URL: process.env.EXPO_PUBLIC_OFF_PRODUCT_BASE_URL,
    EXPO_PUBLIC_OFF_CONTACT_EMAIL: process.env.EXPO_PUBLIC_OFF_CONTACT_EMAIL,
  };
}

let cached: AppConfig | undefined;

/** Validates once (startup, ARCH-17) and returns the cached config. Throws `ConfigError`. */
export function getConfig(): AppConfig {
  cached ??= parseConfig(readProcessEnv(), Constants.expoConfig?.version ?? '0.0.0');
  return cached;
}
