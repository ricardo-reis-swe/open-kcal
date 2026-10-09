// ROAD-06: release builds are signed with the project's release key when the ANDROID_KEYSTORE_* env vars are set
// (the Release workflow). Without them, local release builds keep the template's debug key (ROAD-04).
const { withAppBuildGradle } = require('expo/config-plugins');

const KEYSTORE_ENV = "System.getenv('ANDROID_KEYSTORE_PATH')";

const RELEASE_SIGNING_CONFIG = `
        release {
            if (${KEYSTORE_ENV}) {
                storeFile file(${KEYSTORE_ENV})
                storePassword System.getenv('ANDROID_KEYSTORE_PASSWORD')
                keyAlias System.getenv('ANDROID_KEY_ALIAS')
                keyPassword System.getenv('ANDROID_KEY_PASSWORD')
            }
        }`;

function addReleaseSigning(gradle) {
  if (gradle.includes(KEYSTORE_ENV)) return gradle;
  // The release build type comes first: after the next step, `signingConfigs` holds a `release {` block too.
  const buildType = /(buildTypes \{[\s\S]*?release \{[\s\S]*?)signingConfig signingConfigs\.debug/;
  const signingConfigs = /signingConfigs \{/;
  if (!buildType.test(gradle) || !signingConfigs.test(gradle)) {
    throw new Error('withAndroidReleaseSigning: app/build.gradle no longer matches the Expo template');
  }
  return gradle
    .replace(buildType, `$1signingConfig = ${KEYSTORE_ENV} ? signingConfigs.release : signingConfigs.debug`)
    .replace(signingConfigs, `signingConfigs {${RELEASE_SIGNING_CONFIG}`);
}

function withAndroidReleaseSigning(config) {
  return withAppBuildGradle(config, (c) => {
    c.modResults.contents = addReleaseSigning(c.modResults.contents);
    return c;
  });
}

module.exports = withAndroidReleaseSigning;
module.exports.addReleaseSigning = addReleaseSigning;
