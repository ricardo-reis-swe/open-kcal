import './polyfills';

import { initI18n } from '@/shared/i18n/i18n';
import { logger } from '@/shared/logging/logger';

/**
 * Synchronous startup (ARCH-17): logger + i18n only, so the launch and recovery screens are always translated.
 * Config validation and the async steps (SQLite → migrate + seed → services → Query) run in `startServices`
 * behind `StartupGate`, so any failure shows the recovery screen (UX-20) instead of crashing.
 */
export function initializeApp(): void {
  initI18n();
  // ARCH-22: i18next plurals need Intl.PluralRules (polyfilled in ./polyfills when the engine lacks it).
  const pluralRules = typeof Intl !== 'undefined' && typeof Intl.PluralRules === 'function';
  if (!pluralRules) logger.warn('Intl.PluralRules missing; plural strings fall back to the other form');
}
