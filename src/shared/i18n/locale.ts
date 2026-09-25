// Language and formatting-locale resolution (ARCH-22, SCOPE-12). Pure: takes the device locale list.

export const SUPPORTED_LANGUAGES = ['en', 'pt-PT'] as const;
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export const FALLBACK_LANGUAGE: AppLanguage = 'en';

export type DeviceLocale = {
  languageTag: string;
  languageCode: string | null;
  regionCode: string | null;
};

export type AppLocale = {
  /** UI language: which translation file is used. */
  language: AppLanguage;
  /** BCP 47 tag for `Intl` number/date formatting. Follows the device locale (SCOPE-12). */
  formattingLocale: string;
  /** Device region, e.g. `PT`; drives regional defaults such as units. */
  regionCode: string | null;
};

function languageFor(locale: DeviceLocale): AppLanguage | undefined {
  const code = (locale.languageCode ?? locale.languageTag.split('-')[0] ?? '').toLowerCase();
  if (code === 'en') return 'en';
  // pt-PT is the only Portuguese translation, so every Portuguese variant uses it.
  if (code === 'pt') return 'pt-PT';
  return undefined;
}

function isValidTag(tag: string): boolean {
  try {
    return Intl.NumberFormat.supportedLocalesOf([tag]).length > 0;
  } catch {
    return false;
  }
}

/** Picks the first device locale with a supported language (the OS per-app language comes first). */
export function resolveAppLocale(deviceLocales: readonly DeviceLocale[]): AppLocale {
  for (const locale of deviceLocales) {
    const language = languageFor(locale);
    if (language) {
      return {
        language,
        formattingLocale: isValidTag(locale.languageTag) ? locale.languageTag : language,
        regionCode: locale.regionCode,
      };
    }
  }
  const first = deviceLocales[0];
  return {
    language: FALLBACK_LANGUAGE,
    formattingLocale: FALLBACK_LANGUAGE,
    regionCode: first?.regionCode ?? null,
  };
}
