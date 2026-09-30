// App entry (ARCH-23): the widget's headless task is registered before the app root, so it runs even when no UI starts.
import { registerWidgetTaskHandler } from 'react-native-android-widget';

import { widgetTaskHandler } from '@/features/widget/widgetTaskHandler';

registerWidgetTaskHandler(widgetTaskHandler);

// eslint-disable-next-line import/first -- the router entry must load after the handler is registered.
import 'expo-router/entry';
