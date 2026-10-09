const { addReleaseSigning } = require('../withAndroidReleaseSigning');

// The parts of the SDK 57 template's app/build.gradle the plugin rewrites (ROAD-06).
const SDK57_BUILD_GRADLE = `android {
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            // Caution! In production, you need to generate your own keystore file.
            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig signingConfigs.debug
            minifyEnabled enableMinifyInReleaseBuilds
        }
    }
}
`;

describe('addReleaseSigning', () => {
  const result = addReleaseSigning(SDK57_BUILD_GRADLE);

  it('adds a release signing config read from the ANDROID_KEYSTORE_* env vars', () => {
    expect(result).toContain(`signingConfigs {
        release {
            if (System.getenv('ANDROID_KEYSTORE_PATH')) {
                storeFile file(System.getenv('ANDROID_KEYSTORE_PATH'))
                storePassword System.getenv('ANDROID_KEYSTORE_PASSWORD')
                keyAlias System.getenv('ANDROID_KEY_ALIAS')
                keyPassword System.getenv('ANDROID_KEY_PASSWORD')
            }
        }
        debug {`);
  });

  it('signs the release build type with it only when the keystore is set; debug stays on the debug key', () => {
    expect(result).toContain(`release {
            // Caution! In production, you need to generate your own keystore file.
            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig = System.getenv('ANDROID_KEYSTORE_PATH') ? signingConfigs.release : signingConfigs.debug`);
    expect(result).toContain(`debug {
            signingConfig signingConfigs.debug
        }`);
  });

  it('is idempotent', () => {
    expect(addReleaseSigning(result)).toBe(result);
  });

  it('fails loudly when the template changes', () => {
    expect(() => addReleaseSigning('android {}')).toThrow('no longer matches');
  });
});
