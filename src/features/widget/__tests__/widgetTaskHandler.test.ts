import { createDiaryRepository } from '@/data/db/repositories/diaryRepository';
import { createSettingsRepository } from '@/data/db/repositories/settingsRepository';
import { initI18n } from '@/shared/i18n/i18n';
import { logger } from '@/shared/logging/logger';
import { openSeededTestDatabase } from '@/shared/testing/testDb';

import { loadCaloriesLeftWidget } from '../widgetTaskHandler';

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

    const { view, theme } = await loadCaloriesLeftWidget({ open: async () => deps.db, clock: deps.clock });

    expect(view).toMatchObject({ kind: 'left', label: 'kcal left' });
    expect(view.kind !== 'unavailable' && view.value).toBe((goal!.calorie_target_kcal - 450).toLocaleString('en-US'));
    expect(theme).toBe('system');
    expect(close).toHaveBeenCalled();
  });

  it('DS-14: reads the UX-23 theme preference', async () => {
    const deps = await openSeededTestDatabase();
    await createSettingsRepository(deps).setThemePreference('dark');
    expect((await loadCaloriesLeftWidget({ open: async () => deps.db, clock: deps.clock })).theme).toBe('dark');
  });

  it('shows the unavailable state when the database is not migrated yet', async () => {
    expect(await loadCaloriesLeftWidget({ open: async () => null })).toMatchObject({
      view: { kind: 'unavailable' },
      theme: 'system',
    });
  });

  it('never throws: a failed read → unavailable + a warning without diary data (ARCH-15)', async () => {
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const { view, theme } = await loadCaloriesLeftWidget({
      open: async () => {
        throw new TypeError('disk I/O error');
      },
    });
    expect(view).toMatchObject({ kind: 'unavailable' });
    expect(theme).toBe('system');
    expect(warn).toHaveBeenCalledWith('widget read failed', { code: 'unexpected' });
    warn.mockRestore();
  });
});
