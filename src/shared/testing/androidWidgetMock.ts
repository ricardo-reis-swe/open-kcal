// Jest stand-in for react-native-android-widget (ARCH-23): the widget primitives render nothing and the native
// update request is a spy, so app code that refreshes the widget runs unchanged.
export const FlexWidget = () => null;
export const TextWidget = () => null;
export const registerWidgetTaskHandler = jest.fn();
export const requestWidgetUpdate = jest.fn(async () => undefined);
