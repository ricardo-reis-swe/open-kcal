import type { RecipeServingLabels } from '@/domain/food/recipe';
import { openSeededTestDatabase } from '@/shared/testing/testDb';

import { createDiaryRepository, createRecentsRepository } from '../diaryRepository';
import { createFoodsRepository, type CustomFoodInput } from '../foodsRepository';
import { createMealsRepository } from '../mealsRepository';
import { createRecipesRepository, type RecipeInput } from '../recipesRepository';

const labels: RecipeServingLabels = {
  serving: 'serving',
  g_cooked: 'g cooked',
  oz_cooked: 'oz cooked',
  g_raw: 'g raw',
  oz_raw: 'oz raw',
};

const per100g = (name: string, energyKcal: number, proteinG: number | null, salt?: number): CustomFoodInput => ({
  name,
  basisQuantity: 100,
  basisUnit: 'g',
  nutrients: { energyKcal, carbohydrateG: 10, proteinG, fatG: 1, ...(salt === undefined ? {} : { extra: { salt } }) },
  servings: [
    { label: 'g', quantity: 1, unit: 'g', basisMultiplier: 0.01, isDefault: true },
    { label: 'oz', quantity: 1, unit: 'oz', basisMultiplier: 0.28349523125 },
  ],
});

async function setup() {
  const deps = await openSeededTestDatabase();
  const foods = createFoodsRepository(deps);
  const recipes = createRecipesRepository(deps);
  const rice = await foods.createCustom(per100g('Rice', 360, 7, 0));
  const chicken = await foods.createCustom(per100g('Chicken', 165, 31, 0.2));
  const grams = (food: typeof rice) => food.servings.find((s) => s.unit === 'g')!.id;
  const input: RecipeInput = {
    name: ' Chicken rice ',
    servingsCount: 4,
    cookedServingG: 350,
    rawServingGOverride: null,
    ingredients: [
      { foodId: rice.id, servingId: grams(rice), quantity: 400 },
      { foodId: chicken.id, servingId: grams(chicken), quantity: 600 },
    ],
    labels,
  };
  const meals = await createMealsRepository(deps).list();
  return {
    deps,
    foods,
    recipes,
    rice,
    chicken,
    input,
    diary: createDiaryRepository(deps),
    recents: createRecentsRepository(deps),
    lunch: meals[1]!.id,
  };
}

describe('DATA-27 / DATA-28: recipes repository', () => {
  it('creates a recipe as a custom food with per-serving nutrition and cooked/raw servings', async () => {
    const { recipes, input } = await setup();
    const food = await recipes.create(input);
    expect(food).toMatchObject({ source: 'custom', kind: 'recipe', name: 'Chicken rice', basisQuantity: 1 });
    expect(food.basisUnit).toBe('serving');
    expect(food.nutrients.energyKcal).toBeCloseTo(607.5);
    expect(food.nutrients.proteinG).toBeCloseTo(53.5);
    expect(food.nutrients.extra?.salt).toBeCloseTo(0.3);
    expect(food.servings.map((s) => [s.unit, s.label, s.isDefault])).toEqual([
      ['serving', 'serving', true],
      ['g_cooked', 'g cooked', false],
      ['oz_cooked', 'oz cooked', false],
      ['g_raw', 'g raw', false],
      ['oz_raw', 'oz raw', false],
    ]);
    expect(food.servings.find((s) => s.unit === 'g_raw')!.basisMultiplier * 250).toBeCloseTo(1);
  });

  it('reads the recipe back with its ingredients and computed raw weight', async () => {
    const { recipes, input, rice } = await setup();
    const food = await recipes.create(input);
    const recipe = await recipes.get(food.id);
    expect(recipe).toMatchObject({ servingsCount: 4, cookedServingG: 350, rawServingGOverride: null });
    expect(recipe.computedRawServingG).toBeCloseTo(250);
    expect(recipe.ingredients.map((i) => [i.food.name, i.servingUnit, i.quantity])).toEqual([
      ['Rice', 'g', 400],
      ['Chicken', 'g', 600],
    ]);
    expect(recipe.ingredients[0]!.food.id).toBe(rice.id);
    expect(recipe.ingredients[0]!.nutrients.energyKcal).toBeCloseTo(1440);
  });

  it('rejects a recipe as an ingredient (POST-15) and invalid shapes', async () => {
    const { recipes, input } = await setup();
    const food = await recipes.create(input);
    await expect(
      recipes.create({ ...input, ingredients: [{ foodId: food.id, servingId: food.servings[0]!.id, quantity: 1 }] }),
    ).rejects.toMatchObject({ category: 'validation' });
    await expect(recipes.create({ ...input, servingsCount: 0 })).rejects.toMatchObject({ category: 'validation' });
    await expect(recipes.create({ ...input, ingredients: [] })).rejects.toMatchObject({ category: 'validation' });
  });

  it('DATA-28: editing an ingredient food recomputes every recipe using it', async () => {
    const { foods, recipes, input, rice } = await setup();
    const food = await recipes.create(input);
    await foods.updateCustom(rice.id, per100g('Rice', 400, 7, 0));
    const updated = await foods.get(food.id);
    expect(updated.nutrients.energyKcal).toBeCloseTo((1600 + 990) / 4);
  });

  it('DATA-06: an unknown ingredient macro makes the recipe macro unknown', async () => {
    const { foods, recipes, input } = await setup();
    const mystery = await foods.createCustom(per100g('Mystery', 100, null));
    const food = await recipes.create({
      ...input,
      ingredients: [...input.ingredients, { foodId: mystery.id, servingId: mystery.servings[0]!.id, quantity: 100 }],
    });
    expect(food.nutrients.proteinG).toBeNull();
    expect(food.nutrients.extra?.salt).toBeUndefined();
  });

  it('updates in place: serving IDs survive by unit, the override wins, entries keep their snapshots', async () => {
    const { recipes, diary, input, lunch } = await setup();
    const food = await recipes.create(input);
    const servingId = food.servings[0]!.id;
    const entry = await diary.addFoodEntry({
      diaryDate: '2026-09-25',
      mealId: lunch,
      foodId: food.id,
      servingId,
      quantity: 1,
    });
    const updated = await recipes.update(food.id, {
      ...input,
      servingsCount: 2,
      cookedServingG: null,
      rawServingGOverride: 600,
    });
    expect(updated.servings[0]!.id).toBe(servingId);
    expect(updated.servings.map((s) => s.unit)).toEqual(['serving', 'g_raw', 'oz_raw']);
    expect(updated.servings.find((s) => s.unit === 'g_raw')!.basisMultiplier * 600).toBeCloseTo(1);
    expect(updated.nutrients.energyKcal).toBeCloseTo(1215);
    expect((await diary.getEntry(entry.id)).nutrients.energyKcal).toBeCloseTo(607.5);
  });

  it('lists, counts and searches active recipes only; custom food lists exclude recipes', async () => {
    const { foods, recipes, input } = await setup();
    const food = await recipes.create(input);
    await recipes.create({ ...input, name: 'Porridge' });
    expect((await recipes.list()).map((f) => f.name).sort()).toEqual(['Chicken rice', 'Porridge']);
    expect(await recipes.count()).toBe(2);
    expect((await recipes.search('rice')).map((f) => f.id)).toEqual([food.id]);
    expect((await foods.listCustom()).map((f) => f.name).sort()).toEqual(['Chicken', 'Rice']);
    expect(await foods.countCustom()).toBe(2);
    expect((await foods.searchCustom('rice')).map((f) => f.name)).toEqual(['Rice']);
    await foods.deleteFood(food.id);
    expect(await recipes.count()).toBe(1);
    await expect(recipes.update(food.id, input)).rejects.toMatchObject({ category: 'not_found' });
  });

  it('a soft-deleted ingredient food keeps counting and still reads back', async () => {
    const { foods, recipes, input, rice } = await setup();
    const food = await recipes.create(input);
    await foods.deleteFood(rice.id);
    const recipe = await recipes.get(food.id);
    expect(recipe.ingredients[0]!.food.isDeleted).toBe(true);
    expect(recipe.food.nutrients.energyKcal).toBeCloseTo(607.5);
  });
});
