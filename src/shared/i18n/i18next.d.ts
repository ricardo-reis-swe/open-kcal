import 'i18next';

import type en from './locales/en.json';

// Typed translation keys: `t('tabs.diary')` is checked against the en source file (ARCH-02).
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: typeof en };
    returnNull: false;
  }
}
