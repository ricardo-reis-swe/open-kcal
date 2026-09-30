// DATA-22: app-side redraw of every placed widget. Fire-and-forget: never awaited, never shown to the user.
import { Platform } from 'react-native';
import { requestWidgetUpdate } from 'react-native-android-widget';

import { toAppError } from '@/shared/errors';
import { logger } from '@/shared/logging/logger';

import { CaloriesLeftWidget } from './CaloriesLeftWidget';
import { loadCaloriesLeftView } from './widgetTaskHandler';

/** Must match the widget `name` in the app.json plugin config (ARCH-23). */
export const WIDGET_NAME = 'CaloriesLeft';

export function refreshWidget(): void {
  if (Platform.OS !== 'android') return;
  requestWidgetUpdate({
    widgetName: WIDGET_NAME,
    renderWidget: async () => <CaloriesLeftWidget view={await loadCaloriesLeftView()} />,
  }).catch((error: unknown) => logger.warn('widget refresh failed', { code: toAppError(error).category }));
}
