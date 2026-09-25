import { sequentialIds } from '@/data/db/ids';
import { fixedClock } from '@/shared/dates';
import { initI18n } from '@/shared/i18n/i18n';
import { createTestServices } from '@/shared/testing/services';

import { seedDevDiary } from '../devSeed';
import type { AppServices } from '../services';
import { startServices } from '../start-services';

describe('ROAD-01 M2 dev-only seed', () => {
  it('inserts sample days once (idempotent) around today', async () => {
    const { services } = await createTestServices();
    expect(await seedDevDiary(services, '2026-09-25')).toBe(true);
    expect(await seedDevDiary(services, '2026-09-25')).toBe(false);

    const today = await services.diary.loadDay('2026-09-25');
    expect(today.totals.entryCount).toBe(5);
    expect(today.totals.proteinG.unknownCount).toBe(2); // Quick Calories → partial macros (DATA-06)
    const tomorrow = await services.diary.loadDay('2026-09-26');
    expect(tomorrow.totals.energyKcal).toBeGreaterThan(tomorrow.goal!.calorieTargetKcal); // over goal
    expect((await services.diary.loadDay('2026-09-27')).totals.entryCount).toBe(0);
  });
});

describe('ROAD-01 M2 dev seed gating', () => {
  // Startup seeds meal names in the app language, so i18n must be up (ARCH-17 order).
  beforeAll(() => initI18n({ language: 'en', formattingLocale: 'en', regionCode: 'US' }));

  const config = (devSeedDiary: boolean) => () => ({
    appVersion: '0.0.0-test',
    usdaBaseUrl: 'https://api.nal.usda.gov/fdc/v1',
    offSearchBaseUrl: 'https://search.openfoodfacts.org',
    offProductBaseUrl: 'https://world.openfoodfacts.org',
    offContactEmail: 'ricardo_reis@live.com',
    devSeedDiary,
  });
  const clock = fixedClock('2026-09-25T10:00:00.000Z');
  const entriesToday = async (services: AppServices) => (await services.diary.loadDay('2026-09-25')).totals.entryCount;

  it('startup seeds nothing when EXPO_PUBLIC_DEV_SEED_DIARY is off', async () => {
    const services = await startServices({ clock, ids: sequentialIds(), loadConfig: config(false) });
    expect(await entriesToday(services)).toBe(0);
  });

  it('startup seeds sample data in a dev build with the flag on', async () => {
    const services = await startServices({ clock, ids: sequentialIds(), loadConfig: config(true) });
    expect(await entriesToday(services)).toBe(5);
  });

  it('startup never seeds outside __DEV__, even with the flag on', async () => {
    const dev = (globalThis as { __DEV__?: boolean }).__DEV__;
    (globalThis as { __DEV__?: boolean }).__DEV__ = false;
    try {
      const services = await startServices({ clock, ids: sequentialIds(), loadConfig: config(true) });
      expect(await entriesToday(services)).toBe(0);
    } finally {
      (globalThis as { __DEV__?: boolean }).__DEV__ = dev;
    }
  });
});
