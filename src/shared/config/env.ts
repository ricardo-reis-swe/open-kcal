import Constants from 'expo-constants';
import { z } from 'zod';

import { ValidationError } from '@/shared/errors';

// Typed public config (ARCH-14). The only module that reads `process.env`; features import `getConfig()`.
// Treat every value as public: it ships in the bundle.

const httpsUrl = z.url({ protocol: /^https$/ }).transform((value) => value.replace(/\/+$/, ''));

const envSchema = z.object({
  EXPO_PUBLIC_USDA_BASE_URL: httpsUrl,
  EXPO_PUBLIC_OFF_SEARCH_BASE_URL: httpsUrl,
  EXPO_PUBLIC_OFF_PRODUCT_BASE_URL: httpsUrl,
  EXPO_PUBLIC_OFF_CONTACT_EMAIL: z.email(),
  // ROAD-01 M2: dev-only sample diary data. Ignored outside `__DEV__` (see bootstrap/devSeed.ts).
  EXPO_PUBLIC_DEV_SEED_DIARY: z.enum(['0', '1']).optional(),
});

export type RawEnv = Partial<Record<keyof z.input<typeof envSchema>, string | undefined>>;

export type AppConfig = {
  appVersion: string;
  usdaBaseUrl: string;
  offSearchBaseUrl: string;
  offProductBaseUrl: string;
  offContactEmail: string;
  /** Dev builds only: insert sample diary entries around today, once (ROAD-01 M2). */
  devSeedDiary: boolean;
};

/** A typed `ValidationError` (ARCH-13), so startup shows the recovery screen instead of crashing (UX-20). */
export class ConfigError extends ValidationError {
  /** Names of the invalid or missing variables. Never their values. */
  readonly invalidKeys: readonly string[];

  constructor(invalidKeys: readonly string[]) {
    super(`Invalid app config: ${invalidKeys.join(', ')}`, invalidKeys);
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
    devSeedDiary: value.EXPO_PUBLIC_DEV_SEED_DIARY === '1',
  };
}

// Expo inlines `process.env.EXPO_PUBLIC_*` only for static member access, so each key is read explicitly.
function readProcessEnv(): RawEnv {
  return {
    EXPO_PUBLIC_USDA_BASE_URL: process.env.EXPO_PUBLIC_USDA_BASE_URL,
    EXPO_PUBLIC_OFF_SEARCH_BASE_URL: process.env.EXPO_PUBLIC_OFF_SEARCH_BASE_URL,
    EXPO_PUBLIC_OFF_PRODUCT_BASE_URL: process.env.EXPO_PUBLIC_OFF_PRODUCT_BASE_URL,
    EXPO_PUBLIC_OFF_CONTACT_EMAIL: process.env.EXPO_PUBLIC_OFF_CONTACT_EMAIL,
    EXPO_PUBLIC_DEV_SEED_DIARY: process.env.EXPO_PUBLIC_DEV_SEED_DIARY,
  };
}

let cached: AppConfig | undefined;

/** The app version from the native config; needs no validation, so the recovery screen can always show it. */
export function getAppVersion(): string {
  return Constants.expoConfig?.version ?? '0.0.0';
}

/** Validates once (startup, ARCH-17) and returns the cached config. Throws `ConfigError`. */
export function getConfig(): AppConfig {
  cached ??= parseConfig(readProcessEnv(), getAppVersion());
  return cached;
}
