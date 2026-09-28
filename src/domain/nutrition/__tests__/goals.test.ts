import {
  PROVISIONAL_TARGETS,
  goalCaloriesRange,
  parseGoalCalories,
  parseGoalMacro,
  invalidGoalFields,
  gramsFromMacroPercent,
  macroEnergyShare,
  parseGoalMacroPercent,
  percentagesFromMacroGrams,
  planGoalSave,
  resolveGoal,
  type NutritionGoal,
} from '../goals';

const goal = (id: string, effectiveFrom: string, kcal = 2000): NutritionGoal => ({
  id,
  effectiveFrom,
  calorieTargetKcal: kcal,
  carbohydrateTargetG: 250,
  proteinTargetG: 100,
  fatTargetG: 67,
  macroTargetMode: 'grams',
  carbohydrateTargetPercent: null,
  proteinTargetPercent: null,
  fatTargetPercent: null,
});

describe('DATA-09: effective goals', () => {
  const goals = [goal('b', '2026-09-10', 1800), goal('a', '2026-09-01'), goal('c', '2026-10-01', 2200)];

  it('picks the greatest effective_from ≤ date, regardless of input order', () => {
    expect(resolveGoal(goals, '2026-09-01')?.id).toBe('a');
    expect(resolveGoal(goals, '2026-09-09')?.id).toBe('a');
    expect(resolveGoal(goals, '2026-09-10')?.id).toBe('b');
    expect(resolveGoal(goals, '2026-09-30')?.id).toBe('b');
    expect(resolveGoal(goals, '2027-01-01')?.id).toBe('c');
  });

  it('returns null before the first goal', () => {
    expect(resolveGoal(goals, '2026-08-31')).toBeNull();
    expect(resolveGoal([], '2026-09-25')).toBeNull();
  });

  it('upserts the row effective today once goals are confirmed', () => {
    expect(planGoalSave(goals, '2026-10-05', true)).toEqual({
      kind: 'upsertEffectiveToday',
      effectiveFrom: '2026-10-05',
    });
  });

  it('UX-01: the first save updates the provisional row in place, keeping its effective_from', () => {
    expect(planGoalSave([goal('p', '2026-09-01')], '2026-09-25', false)).toEqual({
      kind: 'updateInPlace',
      goalId: 'p',
      effectiveFrom: '2026-09-01',
    });
  });

  it('UX-01: provisional targets are the fixed 2,000 kcal 50/20/30 split', () => {
    expect(PROVISIONAL_TARGETS).toEqual({
      calorieTargetKcal: 2000,
      carbohydrateTargetG: 250,
      proteinTargetG: 100,
      fatTargetG: 67,
    });
  });
});

describe('UX-16 / UX-00: goal helpers', () => {
  it('macro helper uses 4/4/9 kcal per g and the share of the calorie target', () => {
    expect(macroEnergyShare(250, 'carbohydrateG', 2000)).toEqual({ kcal: 1000, percent: 50 });
    expect(macroEnergyShare(100, 'proteinG', 2000)).toEqual({ kcal: 400, percent: 20 });
    expect(macroEnergyShare(10, 'fatG', 0)).toEqual({ kcal: 90, percent: null });
    expect(macroEnergyShare(10, 'fatG', null).percent).toBeNull();
  });

  it('flags calories outside 500–10,000 kcal and macros outside 0–1,000 g', () => {
    expect(invalidGoalFields(PROVISIONAL_TARGETS)).toEqual([]);
    expect(
      invalidGoalFields({ calorieTargetKcal: 499, carbohydrateTargetG: 1001, proteinTargetG: 0, fatTargetG: NaN }),
    ).toEqual(['calorieTargetKcal', 'carbohydrateTargetG', 'fatTargetG']);
    expect(invalidGoalFields({ ...PROVISIONAL_TARGETS, calorieTargetKcal: 10_000 })).toEqual([]);
  });

  it('UX-16: Calories parses whole numbers in the energy unit to kcal within 500–10,000 kcal', () => {
    expect(goalCaloriesRange('kcal')).toEqual({ min: 500, max: 10_000 });
    expect(goalCaloriesRange('kJ')).toEqual({ min: 2092, max: 41_840 });
    expect(parseGoalCalories(' 1800 ', 'kcal')).toBe(1800);
    expect(parseGoalCalories('499', 'kcal')).toBeNull();
    expect(parseGoalCalories('10001', 'kcal')).toBeNull();
    expect(parseGoalCalories('1800.5', 'kcal')).toBeNull();
    expect(parseGoalCalories('', 'kcal')).toBeNull();
    expect(parseGoalCalories('8368', 'kJ')).toBeCloseTo(2000);
    expect(parseGoalCalories('2091', 'kJ')).toBeNull();
  });

  it('UX-16: macro goals are whole grams from 0 to 1,000', () => {
    expect(parseGoalMacro('0')).toBe(0);
    expect(parseGoalMacro('1000')).toBe(1000);
    expect(parseGoalMacro('1001')).toBeNull();
    expect(parseGoalMacro('-1')).toBeNull();
    expect(parseGoalMacro('')).toBeNull();
  });

  it('UX-16: converts a percentage split to grams with 4/4/9 and validates percentage input', () => {
    expect(gramsFromMacroPercent(2400, 50, 'carbohydrateG')).toBe(300);
    expect(gramsFromMacroPercent(2400, 20, 'proteinG')).toBe(120);
    expect(gramsFromMacroPercent(2400, 30, 'fatG')).toBe(80);
    expect(parseGoalMacroPercent('100')).toBe(100);
    expect(parseGoalMacroPercent('101')).toBeNull();
    expect(parseGoalMacroPercent('20.5')).toBeNull();
  });

  it('UX-16: switching fixed grams to percentages produces a whole split totaling 100', () => {
    const percentages = percentagesFromMacroGrams(200, 120, 60);
    expect(Object.values(percentages).reduce((sum, value) => sum + value, 0)).toBe(100);
  });
});
