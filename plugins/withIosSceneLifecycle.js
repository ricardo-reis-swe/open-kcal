// Adopts the UIScene life cycle on iOS. iOS 27 asserts at launch without it
// (`_UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption`), and the SDK 57 native template
// still starts React Native from the app delegate. Expo ships `ExpoAppSceneDelegate` for this; the plugin
// registers it in Info.plist and lets it own the window. Remove once the Expo template adopts scenes.
const { withAppDelegate, withInfoPlist } = require('expo/config-plugins');

const SCENE_DELEGATE_CLASS = 'EXExpoAppSceneDelegate';

const LEGACY_WINDOW_START = `#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif`;

function adoptSceneDelegate(contents) {
  if (contents.includes('ExpoReactNativeFactoryProvider')) return contents;
  if (!contents.includes(LEGACY_WINDOW_START) || !contents.includes('class AppDelegate: ExpoAppDelegate {')) {
    throw new Error(
      'withIosSceneLifecycle: AppDelegate.swift no longer matches the SDK 57 template; update the plugin.',
    );
  }
  return contents
    .replace(
      'class AppDelegate: ExpoAppDelegate {',
      'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {',
    )
    .replace(
      LEGACY_WINDOW_START,
      '    // The window and React Native start in ExpoAppSceneDelegate (UIScene life cycle).',
    );
}

module.exports = function withIosSceneLifecycle(config) {
  config = withInfoPlist(config, (cfg) => {
    cfg.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          { UISceneConfigurationName: 'Default Configuration', UISceneDelegateClassName: SCENE_DELEGATE_CLASS },
        ],
      },
    };
    return cfg;
  });
  return withAppDelegate(config, (cfg) => {
    if (cfg.modResults.language !== 'swift') {
      throw new Error('withIosSceneLifecycle: expected a Swift AppDelegate.');
    }
    cfg.modResults.contents = adoptSceneDelegate(cfg.modResults.contents);
    return cfg;
  });
};

module.exports.adoptSceneDelegate = adoptSceneDelegate;
