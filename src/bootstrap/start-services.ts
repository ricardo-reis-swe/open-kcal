// Async startup steps (ARCH-17): open SQLite → pragmas → migrate + seed → secure storage → repositories/services.
// Network is never required; USDA key presence is checked later and never blocks the diary.
import { getLocales } from 'expo-localization';

import { appIds } from '@/data/db/appIds';
import { appDatabaseLocation, openAppDatabase, type DatabaseLocation } from '@/data/db/database';
import type { IdGenerator } from '@/data/db/ids';
import { seedDefaults } from '@/data/db/seed';
import { cleanTransferCache, recoverInterruptedImport } from '@/data/db/transfer/replaceDatabase';
import { defaultUnitPreferences } from '@/domain/units/units';
import { getConfig, type AppConfig } from '@/shared/config/env';
import { nowUtcIso, systemClock, todayLocal, type Clock } from '@/shared/dates';
import { toAppError } from '@/shared/errors';
import { i18next } from '@/shared/i18n/i18n';
import { logger } from '@/shared/logging/logger';
import { announceAppNotice } from '@/shared/notices/appNotice';

import { seedDevDiary, seedDevFoodSearch } from './devSeed';
import { createServices, type AppServices } from './services';

export type StartOptions = {
  clock?: Clock;
  ids?: IdGenerator;
  loadConfig?: () => AppConfig;
  /** Where the database lives (default: the app's own, ARCH-25). */
  location?: DatabaseLocation;
  /** DATA-32 step 6: the swap's own start. The marker is there on purpose, so recovery and cleanup are skipped. */
  afterImport?: boolean;
};

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
  location = appDatabaseLocation(),
  afterImport = false,
}: StartOptions = {}): Promise<AppServices> {
  const started = clock.now().getTime();
  try {
    // ARCH-17 step 1: validate config (throws a typed ConfigError → recovery screen).
    const config = loadConfig();
    const pluralRules = typeof Intl !== 'undefined' && typeof Intl.PluralRules === 'function';
    logger.info('app initialized', { appVersion: config.appVersion, pluralRules });
    if (!afterImport) {
      // DATA-32: an interrupted import is rolled back before SQLite opens. A failure here propagates to the recovery
      // screen; its Retry runs this again (never a reset).
      if ((await recoverInterruptedImport(location)) === 'rolledBack') {
        announceAppNotice('importInterrupted');
        logger.info('import rolled back at launch');
      }
      // DATA-30: cached export/staged files don't outlive a session. Best effort.
      await cleanTransferCache().catch((error: unknown) =>
        logger.warn('transfer cache cleanup failed', { code: toAppError(error).category }),
      );
    }
    const db = await openAppDatabase(
      {
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
      },
      location,
    );
    try {
      logger.info('database ready', { durationMs: clock.now().getTime() - started });
      const services = createServices({ db, clock, ids, config, databaseLocation: location });
      if (__DEV__ && config.devSeedDiary) await seedDevDiary(services, todayLocal(clock));
      if (__DEV__ && config.devSeedFoodSearch) await seedDevFoodSearch(services);
      return services;
    } catch (error) {
      // No connection may stay open after a failed start (a rollback reopens the file, DATA-32).
      await db.close().catch(() => undefined);
      throw error;
    }
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
