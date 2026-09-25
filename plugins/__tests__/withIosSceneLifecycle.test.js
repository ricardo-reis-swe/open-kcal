const { adoptSceneDelegate } = require('../withIosSceneLifecycle');

// The parts of the SDK 57 bare template's AppDelegate.swift the plugin rewrites (review R1-12).
const SDK57_APP_DELEGATE = `import Expo
import React
import ReactAppDependencyProvider

@UIApplicationMain
public class AppDelegate: ExpoAppDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ExpoReactNativeFactoryDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = ExpoReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
}
`;

describe('withIosSceneLifecycle: adoptSceneDelegate', () => {
  it('hands the window to the scene delegate', () => {
    const out = adoptSceneDelegate(SDK57_APP_DELEGATE);
    expect(out).toContain('class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {');
    expect(out).not.toContain('factory.startReactNative(');
    expect(out).not.toContain('window = UIWindow(');
    expect(out).toContain('return super.application(application, didFinishLaunchingWithOptions: launchOptions)');
  });

  it('is idempotent', () => {
    const once = adoptSceneDelegate(SDK57_APP_DELEGATE);
    expect(adoptSceneDelegate(once)).toBe(once);
  });

  it('throws on an unknown template instead of silently skipping', () => {
    const changed = SDK57_APP_DELEGATE.replace('withModuleName: "main"', 'withModuleName: "other"');
    expect(() => adoptSceneDelegate(changed)).toThrow(/no longer matches the SDK 57 template/);
  });
});
