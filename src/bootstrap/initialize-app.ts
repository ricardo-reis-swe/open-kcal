import { getConfig, type AppConfig } from '@/shared/config/env';
import { initI18n } from '@/shared/i18n/i18n';
import { logger } from '@/shared/logging/logger';

export type AppInit = { config: AppConfig };

/**
 * Synchronous startup steps (ARCH-17): validate config → logger → i18n.
 * SQLite, migrations, seed and the recovery screen join this sequence in M1.
 */
export function initializeApp(): AppInit {
  const config = getConfig();
  initI18n();
  logger.info('app initialized', { appVersion: config.appVersion });
  return { config };
}
