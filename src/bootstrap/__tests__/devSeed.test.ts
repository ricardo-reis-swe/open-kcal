import { createTestServices } from '@/shared/testing/services';

import { seedDevDiary } from '../devSeed';

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
