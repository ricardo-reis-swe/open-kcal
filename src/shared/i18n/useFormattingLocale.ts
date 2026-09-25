import { useTranslation } from 'react-i18next';

import { getAppLocale } from './i18n';

/** The `Intl` formatting locale (ARCH-22). Subscribes to i18n so a live locale change re-renders the caller. */
export function useFormattingLocale(): string {
  useTranslation();
  return getAppLocale().formattingLocale;
}
