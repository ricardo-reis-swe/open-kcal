import { DEFAULT_FOOD_SEARCH_SECTIONS } from '@/domain/food/searchSections';
import { openSeededTestDatabase } from '@/shared/testing/testDb';

import { createGoalsRepository } from '../goalsRepository';
import { createSettingsRepository } from '../settingsRepository';

const targets = (kcal: number) => ({
  calorieTargetKcal: kcal,
  carbohydrateTargetG: 200,
  proteinTargetG: 150,
  fatTargetG: 70,
});

describe('DATA-04: settings repository', () => {
  it('reads the seeded settings and changes units without touching other records', async () => {
    const deps = await openSeededTestDatabase();
    const settings = createSettingsRepository(deps);
    expect(await settings.get()).toEqual({
      weightUnit: 'kg',
      foodWeightUnit: 'g',
      energyUnit: 'kcal',
      volumeUnit: 'ml',
      goalWeightKg: null,
      goalsConfirmedAt: null,
    });
    const goalsBefore = await deps.db.getAll('SELECT * FROM nutrition_goals');
    expect(await settings.updateUnits({ weightUnit: 'lb', energyUnit: 'kJ' })).toMatchObject({
      weightUnit: 'lb',
      energyUnit: 'kJ',
      foodWeightUnit: 'g',
    });
    expect(await deps.db.getAll('SELECT * FROM nutrition_goals')).toEqual(goalsBefore);
  });

  it('sets and clears the goal weight in kg', async () => {
    const settings = createSettingsRepository(await openSeededTestDatabase());
    expect((await settings.setGoalWeightKg(70.5)).goalWeightKg).toBe(70.5);
    expect((await settings.setGoalWeightKg(null)).goalWeightKg).toBeNull();
    await expect(settings.setGoalWeightKg(0)).rejects.toMatchObject({ category: 'validation' });
  });

  it('DATA-19: stores Food Search section order + visibility and rejects invalid writes', async () => {
    const deps = await openSeededTestDatabase();
    const settings = createSettingsRepository(deps);
    expect(await settings.getFoodSearchSections()).toEqual(DEFAULT_FOOD_SEARCH_SECTIONS);
    const next = [
      { id: 'usda', visible: true },
      { id: 'custom', visible: true },
      { id: 'saved', visible: false },
      { id: 'open_food_facts', visible: false },
    ] as const;
    expect(await settings.setFoodSearchSections(next)).toEqual(next);
    expect(await settings.getFoodSearchSections()).toEqual(next);
    const hidden = next.map((s) => ({ ...s, visible: false }));
    await expect(settings.setFoodSearchSections(hidden)).rejects.toMatchObject({ category: 'validation' });
    await expect(settings.setFoodSearchSections(next.slice(1))).rejects.toMatchObject({ category: 'validation' });
    expect(await settings.getFoodSearchSections()).toEqual(next);
  });

  it('DATA-19: corrupt stored sections read as the default instead of crashing', async () => {
    const deps = await openSeededTestDatabase();
    await deps.db.run("UPDATE app_settings SET food_search_sections = 'not json'");
    expect(await createSettingsRepository(deps).getFoodSearchSections()).toEqual(DEFAULT_FOOD_SEARCH_SECTIONS);
  });

  it('ARCH-03: a corrupt settings row fails as a DatabaseError', async () => {
    const deps = await openSeededTestDatabase();
    await deps.db.exec('PRAGMA ignore_check_constraints = ON');
    await deps.db.run("UPDATE app_settings SET weight_unit = 'stone'");
    await expect(createSettingsRepository(deps).get()).rejects.toMatchObject({ category: 'database' });
  });
});

describe('DATA-09 / UX-01: goals repository', () => {
  it('starts provisional with the seeded goal effective from the first-launch date', async () => {
    const goals = createGoalsRepository(await openSeededTestDatabase());
    expect(await goals.isProvisional()).toBe(true);
    expect(await goals.goalFor('2026-09-25')).toMatchObject({ effectiveFrom: '2026-09-25', calorieTargetKcal: 2000 });
    expect(await goals.goalFor('2026-09-24')).toBeNull();
    expect(await goals.goalFor('2030-01-01')).toMatchObject({ effectiveFrom: '2026-09-25' });
  });

  it('UX-01: the first save updates the provisional row in place and confirms goals', async () => {
    const deps = await openSeededTestDatabase();
    const goals = createGoalsRepository(deps);
    deps.clock.set('2026-10-03T09:00:00.000Z');
    const saved = await goals.save(targets(1800));
    expect(saved).toMatchObject({ effectiveFrom: '2026-09-25', calorieTargetKcal: 1800, proteinTargetG: 150 });
    expect(await goals.list()).toHaveLength(1);
    expect(await goals.isProvisional()).toBe(false);
    expect(await goals.goalFor('2026-09-25')).toMatchObject({ calorieTargetKcal: 1800 });
  });

  it('DATA-09: later saves upsert the row effective today; past days keep their targets', async () => {
    const deps = await openSeededTestDatabase();
    const goals = createGoalsRepository(deps);
    await goals.save(targets(1800)); // first save, in place
    deps.clock.set('2026-10-03T09:00:00.000Z');
    await goals.save(targets(2100));
    await goals.save(targets(2200)); // same day: updates today's row
    expect((await goals.list()).map((g) => [g.effectiveFrom, g.calorieTargetKcal])).toEqual([
      ['2026-09-25', 1800],
      ['2026-10-03', 2200],
    ]);
    expect(await goals.goalFor('2026-10-02')).toMatchObject({ calorieTargetKcal: 1800 });
    expect(await goals.goalFor('2026-10-03')).toMatchObject({ calorieTargetKcal: 2200 });
  });

  it('UX-16: persists percentage mode, its exact split, and the derived canonical grams', async () => {
    const goals = createGoalsRepository(await openSeededTestDatabase());
    const saved = await goals.save({
      calorieTargetKcal: 2400,
      carbohydrateTargetG: 300,
      proteinTargetG: 120,
      fatTargetG: 80,
      macroTargetMode: 'percent',
      carbohydrateTargetPercent: 50,
      proteinTargetPercent: 20,
      fatTargetPercent: 30,
    });
    expect(saved).toMatchObject({
      macroTargetMode: 'percent',
      carbohydrateTargetPercent: 50,
      proteinTargetPercent: 20,
      fatTargetPercent: 30,
      carbohydrateTargetG: 300,
      proteinTargetG: 120,
      fatTargetG: 80,
    });
  });

  it('DATA-09: percentage mode derives canonical grams from the calorie target, ignoring stale gram inputs', async () => {
    const goals = createGoalsRepository(await openSeededTestDatabase());
    const saved = await goals.save({
      calorieTargetKcal: 2000,
      carbohydrateTargetG: 1,
      proteinTargetG: 1,
      fatTargetG: 1,
      macroTargetMode: 'percent',
      carbohydrateTargetPercent: 40,
      proteinTargetPercent: 30,
      fatTargetPercent: 30,
    });
    expect(saved.carbohydrateTargetG).toBeCloseTo(200);
    expect(saved.proteinTargetG).toBeCloseTo(150);
    expect(saved.fatTargetG).toBeCloseTo(66.667, 2);
  });

  it('rejects invalid targets without writing', async () => {
    const deps = await openSeededTestDatabase();
    const goals = createGoalsRepository(deps);
    await expect(goals.save({ ...targets(0), fatTargetG: -1 })).rejects.toMatchObject({
      category: 'validation',
      fields: ['calorieTargetKcal', 'fatTargetG'],
    });
    expect(await goals.isProvisional()).toBe(true);
  });
});
