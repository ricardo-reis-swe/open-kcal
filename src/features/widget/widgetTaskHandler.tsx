// ARCH-23 headless task: every widget event re-reads today from SQLite and redraws. Never throws; any failure
// renders the UX-22 unavailable state and logs without diary data (ARCH-15).
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';

import { openWidgetDatabase } from '@/data/db/database';
import type { SqlDatabase } from '@/data/db/sql';
import { systemClock, type Clock } from '@/shared/dates';
import { getAppLocale, initI18n } from '@/shared/i18n/i18n';
import { logger } from '@/shared/logging/logger';

import { CaloriesLeftWidget } from './CaloriesLeftWidget';
import { caloriesLeftView, type CaloriesLeftView, type WidgetDay } from './caloriesLeftViewModel';
import { readWidgetDay } from './readWidgetDay';

type Deps = { open?: () => Promise<SqlDatabase | null>; clock?: Clock };

export async function loadCaloriesLeftView({
  open = openWidgetDatabase,
  clock = systemClock,
}: Deps = {}): Promise<CaloriesLeftView> {
  const i18n = initI18n();
  let day: WidgetDay | null = null;
  let db: SqlDatabase | null = null;
  try {
    db = await open();
    if (db) day = await readWidgetDay(db, clock);
  } catch (error) {
    logger.warn('widget read failed', { errorName: error instanceof Error ? error.name : typeof error });
  } finally {
    await db?.close().catch(() => undefined);
  }
  return caloriesLeftView(day, i18n.t, getAppLocale().formattingLocale);
}

export async function widgetTaskHandler({ widgetAction, renderWidget }: WidgetTaskHandlerProps): Promise<void> {
  if (widgetAction === 'WIDGET_DELETED') return;
  renderWidget(<CaloriesLeftWidget view={await loadCaloriesLeftView()} />);
}
