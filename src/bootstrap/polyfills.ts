// ARCH-22: Hermes (SDK 57, iOS + Android) ships without Intl.PluralRules, which i18next needs for plural keys.
// `polyfill` installs only when the engine lacks it. Locale data only for the supported languages.
import '@formatjs/intl-pluralrules/polyfill.js';
import '@formatjs/intl-pluralrules/locale-data/en.js';
import '@formatjs/intl-pluralrules/locale-data/pt.js';
import '@formatjs/intl-pluralrules/locale-data/pt-PT.js';
