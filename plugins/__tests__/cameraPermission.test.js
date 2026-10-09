// ARCH-24 / ARCH-22: the camera permission text in app.json (en) and the iOS pt-PT locale match the app's strings.
const app = require('../../app.json');
const iosPt = require('../../locales/ios/pt-PT.json');
const en = require('../../src/shared/i18n/locales/en.json');
const pt = require('../../src/shared/i18n/locales/pt-PT.json');

describe('camera permission text', () => {
  it('uses the en string for the expo-camera plugin, with no microphone', () => {
    const plugin = app.expo.plugins.find((entry) => Array.isArray(entry) && entry[0] === 'expo-camera');
    expect(plugin[1]).toEqual({
      cameraPermission: en.barcode.cameraPermission,
      microphonePermission: false,
      recordAudioAndroid: false,
    });
  });

  it('localizes NSCameraUsageDescription for pt-PT, on iOS only', () => {
    // Under `ios` so Expo doesn't also write it to Android strings.xml, which fails release lint (ROAD-06).
    expect(app.expo.locales['pt-PT']).toBe('./locales/ios/pt-PT.json');
    expect(iosPt).toEqual({ ios: { NSCameraUsageDescription: pt.barcode.cameraPermission } });
  });
});
