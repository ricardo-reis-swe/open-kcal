import { getAppLocale, i18next, initI18n } from '../i18n';

describe('ARCH-22: i18n runtime', () => {
  it('translates in en and pt-PT and falls back to en for a missing key', () => {
    initI18n({ language: 'en', formattingLocale: 'en', regionCode: null });
    expect(i18next.t('tabs.diary')).toBe('Diary');

    initI18n({ language: 'pt-PT', formattingLocale: 'pt-PT', regionCode: 'PT' });
    expect(getAppLocale().language).toBe('pt-PT');
    expect(i18next.t('tabs.diary')).toBe('Diário');

    i18next.addResource('en', 'translation', 'test.onlyInEnglish', 'English only');
    expect(i18next.t('test.onlyInEnglish' as 'tabs.diary')).toBe('English only');
  });
});
