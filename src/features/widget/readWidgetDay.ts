// ARCH-23: the widget's read of today, through the same repositories as the Diary (no duplicated goal or totals math).
import { appIds } from '@/data/db/appIds';
import { createDiaryRepository } from '@/data/db/repositories/diaryRepository';
import { readSettings } from '@/data/db/repositories/settingsRepository';
import type { SqlDatabase } from '@/data/db/sql';
import { todayLocal, type Clock } from '@/shared/dates';

import type { WidgetDay } from './caloriesLeftViewModel';

export async function readWidgetDay(db: SqlDatabase, clock: Clock): Promise<WidgetDay> {
  const day = await createDiaryRepository({ db, clock, ids: appIds }).loadDay(todayLocal(clock));
  const { energyUnit } = await readSettings(db);
  return { goalKcal: day.goal?.calorieTargetKcal ?? null, eatenKcal: day.totals.energyKcal, unit: energyUnit };
}
