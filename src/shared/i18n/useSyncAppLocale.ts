import { useLocales } from 'expo-localization';
import { useEffect } from 'react';

import { initI18n } from './i18n';
import { resolveAppLocale } from './locale';

/**
 * Keeps i18next on the OS (per-app) language while the app runs (SCOPE-12, ARCH-22). Android handles locale
 * config changes in-process (`configChanges` includes `locale`), so the activity isn't recreated; iOS relaunches
 * the app on a per-app language change, which startup already covers.
 */
export function useSyncAppLocale(): void {
  const locales = useLocales();
  useEffect(() => {
    initI18n(resolveAppLocale(locales));
  }, [locales]);
}
