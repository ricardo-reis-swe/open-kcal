// Async startup steps (ARCH-17): open SQLite → pragmas → migrate + seed → secure storage → repositories/services.
// Network is never required; USDA key presence is checked later and never blocks the diary.
import { getLocales } from 'expo-localization';

import { appIds } from '@/data/db/appIds';
import { openAppDatabase } from '@/data/db/database';
import type { IdGenerator } from '@/data/db/ids';
import { seedDefaults } from '@/data/db/seed';
import { defaultUnitPreferences } from '@/domain/units/units';
import { getConfig, type AppConfig } from '@/shared/config/env';
import { nowUtcIso, systemClock, todayLocal, type Clock } from '@/shared/dates';
import { toAppError } from '@/shared/errors';
import { i18next } from '@/shared/i18n/i18n';
import { logger } from '@/shared/logging/logger';

import { createServices, type AppServices } from './services';

export type StartOptions = { clock?: Clock; ids?: IdGenerator; loadConfig?: () => AppConfig };

/** Default meal names in the current app language, written once at first launch (DATA-10). */
function defaultMealNames(): string[] {
  return [
    i18next.t('seed.meals.breakfast'),
    i18next.t('seed.meals.lunch'),
    i18next.t('seed.meals.dinner'),
    i18next.t('seed.meals.snacks'),
  ];
}

export async function startServices({
  clock = systemClock,
  ids = appIds,
  loadConfig = getConfig,
}: StartOptions = {}): Promise<AppServices> {
  const started = clock.now().getTime();
  try {
    // ARCH-17 step 1: validate config (throws a typed ConfigError → recovery screen).
    const config = loadConfig();
    const pluralRules = typeof Intl !== 'undefined' && typeof Intl.PluralRules === 'function';
    logger.info('app initialized', { appVersion: config.appVersion, pluralRules });
    const db = await openAppDatabase({
      clock,
      logger,
      seed: async (tx) => {
        await seedDefaults(tx, {
          now: nowUtcIso(clock),
          today: todayLocal(clock),
          units: defaultUnitPreferences(getLocales()[0]?.measurementSystem),
          mealNames: defaultMealNames(),
          ids,
        });
      },
    });
    logger.info('database ready', { durationMs: clock.now().getTime() - started });
    return createServices({ db, clock, ids, config });
  } catch (error) {
    const appError = toAppError(error);
    // ARCH-15: category (and migration version) only.
    logger.error('startup failed', appError, {
      code: appError.category,
      version: 'version' in appError ? Number(appError.version) : undefined,
    });
    throw appError;
  }
}
