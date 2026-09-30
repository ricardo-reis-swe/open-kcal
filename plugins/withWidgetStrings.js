// ARCH-23: the widget picker label and description in en + pt-PT. react-native-android-widget writes both as literal
// text, so app.json points them at these string resources instead. Text comes from the app's locale files
// (ARCH-22: one source for UI strings, covered by the key-parity test).
const fs = require('fs');
const path = require('path');
const { AndroidConfig, withDangerousMod, withStringsXml } = require('expo/config-plugins');

const en = require('../src/shared/i18n/locales/en.json');
const ptPT = require('../src/shared/i18n/locales/pt-PT.json');

// `setStringItem` escapes on its own; only the hand-written pt-PT file needs `escapeXmlString`.
const escapeXmlString = (text) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, "\\'");
const items = (locale) => [
  { $: { name: 'widget_calories_left_label' }, _: locale.widget.pickerLabel },
  { $: { name: 'widget_calories_left_description' }, _: locale.widget.pickerDescription },
];

function withWidgetStrings(config) {
  config = withStringsXml(config, (c) => {
    c.modResults = AndroidConfig.Strings.setStringItem(items(en), c.modResults);
    return c;
  });
  return withDangerousMod(config, [
    'android',
    async (c) => {
      const dir = path.join(c.modRequest.platformProjectRoot, 'app/src/main/res/values-pt-rPT');
      fs.mkdirSync(dir, { recursive: true });
      const body = items(ptPT)
        .map((item) => `  <string name="${item.$.name}">${escapeXmlString(item._)}</string>`)
        .join('\n');
      fs.writeFileSync(
        path.join(dir, 'strings.xml'),
        `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n${body}\n</resources>\n`,
      );
      return c;
    },
  ]);
}

module.exports = withWidgetStrings;
