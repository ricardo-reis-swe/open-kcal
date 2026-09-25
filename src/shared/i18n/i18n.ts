import { getLocales } from 'expo-localization';
import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import { FALLBACK_LANGUAGE, resolveAppLocale, type AppLocale } from './locale';
import en from './locales/en.json';
import ptPT from './locales/pt-PT.json';

export const resources = {
  en: { translation: en },
  'pt-PT': { translation: ptPT },
} as const;

/** The app's single i18next instance, provided to React via `I18nextProvider`/`initReactI18next`. */
export const i18next = createInstance();

let appLocale: AppLocale | undefined;

/** The resolved UI language and formatting locale. Available after `initI18n()`. */
export function getAppLocale(): AppLocale {
  if (!appLocale) throw new Error('i18n is not initialized');
  return appLocale;
}

/** Initializes i18next once from the device locales (ARCH-17 startup). Safe to call repeatedly. */
export function initI18n(locale: AppLocale = resolveAppLocale(getLocales())): typeof i18next {
  appLocale = locale;
  if (i18next.isInitialized) {
    if (i18next.language !== locale.language) void i18next.changeLanguage(locale.language);
    return i18next;
  }
  void i18next.use(initReactI18next).init({
    resources,
    lng: locale.language,
    fallbackLng: FALLBACK_LANGUAGE,
    // Missing pt-PT keys fall back to en; the parity test keeps the files in sync.
    interpolation: { escapeValue: false },
    returnNull: false,
    initAsync: false,
  });
  return i18next;
}
