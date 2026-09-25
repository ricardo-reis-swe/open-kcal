import { resolveAppLocale, type DeviceLocale } from '../locale';

const loc = (languageTag: string, regionCode: string | null = null): DeviceLocale => ({
  languageTag,
  languageCode: languageTag.split('-')[0] ?? null,
  regionCode,
});

describe('ARCH-22 / SCOPE-12: app locale resolution', () => {
  it('uses pt-PT for a Portuguese (Portugal) device', () => {
    expect(resolveAppLocale([loc('pt-PT', 'PT')])).toEqual({
      language: 'pt-PT',
      formattingLocale: 'pt-PT',
      regionCode: 'PT',
    });
  });

  it('uses pt-PT for any Portuguese variant but keeps the device formatting locale', () => {
    expect(resolveAppLocale([loc('pt-BR', 'BR')])).toMatchObject({ language: 'pt-PT', formattingLocale: 'pt-BR' });
  });

  it('uses English with the device region formatting, e.g. English in Portugal', () => {
    expect(resolveAppLocale([loc('en-PT', 'PT')])).toEqual({
      language: 'en',
      formattingLocale: 'en-PT',
      regionCode: 'PT',
    });
  });

  it('takes the first supported language in preference order', () => {
    expect(resolveAppLocale([loc('fr-FR', 'FR'), loc('pt-PT', 'PT'), loc('en-US', 'US')])).toMatchObject({
      language: 'pt-PT',
    });
  });

  it('falls back to en when no device language is supported', () => {
    expect(resolveAppLocale([loc('de-DE', 'DE')])).toEqual({
      language: 'en',
      formattingLocale: 'en',
      regionCode: 'DE',
    });
  });

  it('formats numbers with a comma decimal in pt-PT', () => {
    const { formattingLocale } = resolveAppLocale([loc('pt-PT', 'PT')]);
    expect(new Intl.NumberFormat(formattingLocale).format(1.5)).toBe('1,5');
  });
});
