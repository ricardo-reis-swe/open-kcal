import { act, renderHook } from '@testing-library/react-native';
import * as Localization from 'expo-localization';

import { getAppLocale, i18next, initI18n } from '../i18n';
import { useSyncAppLocale } from '../useSyncAppLocale';

jest.mock('expo-localization', () => ({
  getLocales: jest.fn(() => [{ languageTag: 'en-US', languageCode: 'en', regionCode: 'US' }]),
  useLocales: jest.fn(),
}));

const useLocales = Localization.useLocales as jest.MockedFunction<typeof Localization.useLocales>;
const locale = (languageTag: string, regionCode: string) =>
  [{ languageTag, languageCode: languageTag.split('-')[0] ?? null, regionCode }] as unknown as ReturnType<
    typeof Localization.useLocales
  >;

describe('SCOPE-12 / ARCH-22: follows the OS per-app language at runtime', () => {
  it('switches i18next when the device locale list changes', async () => {
    initI18n({ language: 'en', formattingLocale: 'en-US', regionCode: 'US' });
    useLocales.mockReturnValue(locale('en-US', 'US'));
    const { rerender } = await renderHook(() => useSyncAppLocale());
    expect(i18next.language).toBe('en');

    useLocales.mockReturnValue(locale('pt-PT', 'PT'));
    await act(async () => rerender({}));
    expect(i18next.language).toBe('pt-PT');
    expect(i18next.t('tabs.diary')).toBe('Diário');
    expect(getAppLocale()).toEqual({ language: 'pt-PT', formattingLocale: 'pt-PT', regionCode: 'PT' });
  });
});
