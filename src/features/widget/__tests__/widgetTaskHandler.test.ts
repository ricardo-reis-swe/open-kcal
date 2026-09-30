import { createDiaryRepository } from '@/data/db/repositories/diaryRepository';
import { initI18n } from '@/shared/i18n/i18n';
import { logger } from '@/shared/logging/logger';
import { openSeededTestDatabase } from '@/shared/testing/testDb';

import { loadCaloriesLeftView } from '../widgetTaskHandler';

jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en-US', languageCode: 'en' }] }));

describe('ARCH-23: widget task handler', () => {
  beforeEach(() => {
    initI18n({ language: 'en', formattingLocale: 'en-US', regionCode: 'US' });
  });

  it("reads today's goal and entries through the repositories, then closes the connection", async () => {
    const deps = await openSeededTestDatabase();
    const meal = await deps.db.getFirst<{ id: string }>('SELECT id FROM meals ORDER BY sort_order');
    const diary = createDiaryRepository(deps);
    const today = deps.clock.now().toISOString().slice(0, 10);
    await diary.addQuickCalories({ diaryDate: today, mealId: meal!.id, energyKcal: 450 });
    const goal = await deps.db.getFirst<{ calorie_target_kcal: number }>(
      'SELECT calorie_target_kcal FROM nutrition_goals',
    );
    const close = jest.spyOn(deps.db, 'close');

    const view = await loadCaloriesLeftView({ open: async () => deps.db, clock: deps.clock });

    expect(view).toMatchObject({ kind: 'left', label: 'kcal left' });
    expect(view.kind !== 'unavailable' && view.value).toBe((goal!.calorie_target_kcal - 450).toLocaleString('en-US'));
    expect(close).toHaveBeenCalled();
  });

  it('shows the unavailable state when the database is not migrated yet', async () => {
    expect(await loadCaloriesLeftView({ open: async () => null })).toMatchObject({ kind: 'unavailable' });
  });

  it('never throws: a failed read → unavailable + a warning without diary data (ARCH-15)', async () => {
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const view = await loadCaloriesLeftView({
      open: async () => {
        throw new TypeError('disk I/O error');
      },
    });
    expect(view).toMatchObject({ kind: 'unavailable' });
    expect(warn).toHaveBeenCalledWith('widget read failed', { code: 'unexpected' });
    warn.mockRestore();
  });
});
