// ARCH-23 headless task: every widget event re-reads today from SQLite and redraws. Never throws; any failure
// renders the UX-22 unavailable state and logs without diary data (ARCH-15).
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';

import { openWidgetDatabase } from '@/data/db/database';
import { readThemePreference } from '@/data/db/repositories/settingsRepository';
import type { SqlDatabase } from '@/data/db/sql';
import { systemClock, type Clock } from '@/shared/dates';
import { getAppLocale, initI18n } from '@/shared/i18n/i18n';
import { toAppError } from '@/shared/errors';
import { logger } from '@/shared/logging/logger';
import type { ThemePreference } from '@/shared/theme/theme';

import { renderCaloriesLeftWidget } from './CaloriesLeftWidget';
import { caloriesLeftView, type CaloriesLeftView, type WidgetDay } from './caloriesLeftViewModel';
import { readWidgetDay } from './readWidgetDay';

type Deps = { open?: () => Promise<SqlDatabase | null>; clock?: Clock };

export type CaloriesLeftWidgetData = { view: CaloriesLeftView; theme: ThemePreference };

/** The UX-22 view plus the UX-23 theme; the theme falls back to `system` whenever the DB can't be read. */
export async function loadCaloriesLeftWidget({
  open = openWidgetDatabase,
  clock = systemClock,
}: Deps = {}): Promise<CaloriesLeftWidgetData> {
  const i18n = initI18n();
  let day: WidgetDay | null = null;
  let theme: ThemePreference = 'system';
  let db: SqlDatabase | null = null;
  try {
    db = await open();
    if (db) {
      day = await readWidgetDay(db, clock);
      theme = await readThemePreference(db);
    }
  } catch (error) {
    logger.warn('widget read failed', { code: toAppError(error).category });
  } finally {
    await db?.close().catch(() => undefined);
  }
  return { view: caloriesLeftView(day, i18n.t, getAppLocale().formattingLocale), theme };
}

export async function renderLatestWidget() {
  const { view, theme } = await loadCaloriesLeftWidget();
  return renderCaloriesLeftWidget(view, theme);
}

export async function widgetTaskHandler({ widgetAction, renderWidget }: WidgetTaskHandlerProps): Promise<void> {
  if (widgetAction === 'WIDGET_DELETED') return;
  renderWidget(await renderLatestWidget());
}
