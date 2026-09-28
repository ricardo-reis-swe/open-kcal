import { sequentialIds } from '@/data/db/ids';
import { fixedClock } from '@/shared/dates';
import { initI18n } from '@/shared/i18n/i18n';
import { createTestServices } from '@/shared/testing/services';

import { seedDevDiary, seedDevFoodSearch } from '../devSeed';
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
    expect((await services.foods.searchExternal('offline oat')).map((food) => food.name)).toEqual([
      'E2E Offline Oat Bar',
    ]);
    const tomorrow = await services.diary.loadDay('2026-09-26');
    expect(tomorrow.totals.energyKcal).toBeGreaterThan(tomorrow.goal!.calorieTargetKcal); // over goal
    expect((await services.diary.loadDay('2026-09-27')).totals.entryCount).toBe(0);
  });
});

describe('ROAD-01 M2 dev seed gating', () => {
  // Startup seeds meal names in the app language, so i18n must be up (ARCH-17 order).
  beforeAll(() => initI18n({ language: 'en', formattingLocale: 'en', regionCode: 'US' }));

  const config =
    (devSeedDiary: boolean, devSeedFoodSearch = false) =>
    () => ({
      appVersion: '0.0.0-test',
      usdaBaseUrl: 'https://api.nal.usda.gov/fdc/v1',
      offSearchBaseUrl: 'https://search.openfoodfacts.org',
      offProductBaseUrl: 'https://world.openfoodfacts.org',
      offContactEmail: 'ricardo_reis@live.com',
      devSeedDiary,
      devSeedFoodSearch,
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
    expect((await services.foods.searchExternal('offline oat')).map((food) => food.name)).toEqual([
      'E2E Offline Oat Bar',
    ]);
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

describe('ARCH-18 M5 local Food Search seed', () => {
  it('inserts the custom and cached OFF records once', async () => {
    const { services } = await createTestServices();
    expect(await seedDevFoodSearch(services)).toBe(true);
    expect(await seedDevFoodSearch(services)).toBe(false);
    expect((await services.foods.searchCustom('offline e2e')).map((food) => food.name)).toEqual([
      'Offline E2E custom oats',
    ]);
    // The m5-offline-foods cached OFF food comes with it, so both offline flows need only the dev-seed link.
    expect((await services.foods.searchExternal('offline e2e')).map((food) => food.name).sort()).toEqual([
      'E2E Offline Oat Bar',
      'Offline E2E saved yoghurt',
    ]);
  });

  it('ARCH-12 / UX-05: repairs the cached OFF fixture to its egg default and saves 2 × egg as 95 kcal', async () => {
    const { services } = await createTestServices();
    await seedDevFoodSearch(services);
    const cached = (await services.foods.searchExternal('offline e2e')).find((food) => food.name.includes('yoghurt'))!;
    const egg = cached.servings.find((serving) => serving.label === 'egg')!;
    expect(egg.isDefault).toBe(true);

    const lunch = (await services.meals.list()).find((meal) => meal.name === 'Lunch')!;
    await services.diary.addFoodEntry({
      diaryDate: '2026-09-25',
      mealId: lunch.id,
      foodId: cached.id,
      servingId: egg.id,
      quantity: 2,
    });
    const entry = (await services.diary.loadDay('2026-09-25')).meals.find((meal) => meal.meal.id === lunch.id)!
      .entries[0]!;
    expect(entry).toMatchObject({
      name: 'Offline E2E saved yoghurt',
      servingQuantity: 2,
      servingUnit: 'egg',
      nutrients: { energyKcal: 95 },
    });
  });

  it('repairs the obsolete gram-serving fixture and stale recent choice on an existing dev DB', async () => {
    const { services } = await createTestServices();
    await services.foods.createCustom({
      name: 'Offline E2E custom oats',
      basisQuantity: 100,
      basisUnit: 'g',
      nutrients: { energyKcal: 372, carbohydrateG: 60, proteinG: 13, fatG: 7 },
      servings: [{ label: 'g', quantity: 1, unit: 'g', basisMultiplier: 0.01, isDefault: true }],
    });
    const stale = await services.foods.upsertExternal(
      'open_food_facts',
      'm5-offline-e2e-yoghurt',
      {
        name: 'Offline E2E saved yoghurt',
        basisQuantity: 100,
        basisUnit: 'g',
        nutrients: { energyKcal: 95, carbohydrateG: 4, proteinG: 8, fatG: 5 },
        servings: [{ label: 'g', quantity: 1, unit: 'g', basisMultiplier: 0.01, isDefault: true }],
      },
      {
        fetchedAt: '2026-01-01T00:00:00.000Z',
        expiresAt: '2026-01-02T00:00:00.000Z',
        rawPayloadJson: null,
        schemaVersion: 1,
      },
    );
    const lunch = (await services.meals.list()).find((meal) => meal.name === 'Lunch')!;
    await services.diary.addFoodEntry({
      diaryDate: '2026-09-25',
      mealId: lunch.id,
      foodId: stale.id,
      servingId: stale.servings[0]!.id,
      quantity: 102,
    });

    expect(await seedDevFoodSearch(services)).toBe(true);
    const repaired = (await services.foods.searchExternal('offline e2e'))[0]!;
    const egg = repaired.servings.find((serving) => serving.label === 'egg')!;
    expect(
      await services.db.getFirst<{ last_serving_id: string; last_serving_quantity: number }>(
        'SELECT last_serving_id, last_serving_quantity FROM recent_foods WHERE food_id = ?',
        [repaired.id],
      ),
    ).toEqual({ last_serving_id: egg.id, last_serving_quantity: 1 });
  });
});
