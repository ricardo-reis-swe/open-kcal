import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react-native';

import type { AppServices } from '@/bootstrap/services';
import { createTestServices, renderWithServices } from '@/shared/testing/services';

import { MealEditScreen } from '../MealEditScreen';

type Params = Parameters<typeof MealEditScreen>[0]['params'];

async function setup(pick: (services: AppServices) => Promise<Params> | Params) {
  const { services } = await createTestServices();
  const params = await pick(services);
  const onDone = jest.fn();
  const onNotFound = jest.fn();
  await renderWithServices(
    <MealEditScreen params={params} onDone={onDone} onBack={jest.fn()} onNotFound={onNotFound} />,
    services,
  );
  return { services, onDone, onNotFound };
}

const mealNamed = async (services: AppServices, name: string) =>
  (await services.meals.list()).find((m) => m.name === name)!;
const edit = (name: string) => async (services: AppServices) =>
  ({ mode: 'edit', mealId: (await mealNamed(services, name)).id }) as const;

afterEach(async () => {
  await cleanup();
});

describe('UX-17 / NAV-06: Add / Edit Meal', () => {
  it('add: a new meal appends at the end, then → Meals; a duplicate name only warns', async () => {
    const { services, onDone } = await setup(() => ({ mode: 'create' }));
    const field = await screen.findByLabelText('Name');
    expect(screen.getByTestId('meal-save')).toBeDisabled();
    await fireEvent.changeText(field, ' lunch ');
    expect(screen.getByText('You already have a meal named Lunch.')).toBeOnTheScreen();
    expect(screen.getByTestId('meal-save')).toBeEnabled();
    await fireEvent.changeText(field, 'Supper');
    expect(screen.queryByTestId('meal-duplicate')).toBeNull();
    expect(screen.queryByTestId('meal-delete')).toBeNull();
    await fireEvent.press(screen.getByTestId('meal-save'));
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect((await services.meals.list()).map((m) => m.name)).toEqual([
      'Breakfast',
      'Lunch',
      'Dinner',
      'Snacks',
      'Supper',
    ]);
  });

  it('UX-00: a name over 40 characters shows the error and cannot save', async () => {
    const { onDone } = await setup(() => ({ mode: 'create' }));
    const field = await screen.findByLabelText('Name');
    await fireEvent.changeText(field, 'x'.repeat(41));
    await fireEvent(field, 'blur');
    expect(screen.getByTestId('meal-save')).toBeDisabled();
    expect(screen.getByText('Enter a name up to 40 characters.')).toBeOnTheScreen();
    expect(onDone).not.toHaveBeenCalled();
  });

  it('edit: rename waits for a change, then saves → Meals', async () => {
    const { services, onDone } = await setup(edit('Snacks'));
    const field = await screen.findByLabelText('Name');
    expect(field.props.value).toBe('Snacks');
    expect(screen.getByTestId('meal-save')).toBeDisabled();
    await fireEvent.changeText(field, 'Evening snack');
    await fireEvent.press(screen.getByTestId('meal-save'));
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect((await services.meals.list())[3]!.name).toBe('Evening snack');
  });

  it('UX-19: a meal with no entries is deleted after the `Delete <meal>?` dialog', async () => {
    const { services, onDone } = await setup(edit('Dinner'));
    await fireEvent.press(await screen.findByTestId('meal-delete'));
    expect(await screen.findByText('Delete Dinner?')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('meal-delete-dialog-confirm'));
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect((await services.meals.list()).map((m) => m.name)).toEqual(['Breakfast', 'Lunch', 'Snacks']);
    expect(screen.queryByTestId('not-found')).toBeNull();
  });

  it('UX-19 / DATA-10: a meal with entries moves them to the picked meal, then is deleted', async () => {
    const { services, onDone } = await setup(async (s) => {
      const lunch = await mealNamed(s, 'Lunch');
      await s.diary.addQuickCalories({ diaryDate: '2026-09-25', mealId: lunch.id, energyKcal: 300, note: null });
      await s.diary.addQuickCalories({ diaryDate: '2026-09-24', mealId: lunch.id, energyKcal: 200, note: null });
      return { mode: 'edit', mealId: lunch.id };
    });
    const dinner = await mealNamed(services, 'Dinner');
    await fireEvent.press(await screen.findByTestId('meal-delete'));
    expect(await screen.findByText('Delete Lunch? It has 2 entries. Move them to:')).toBeOnTheScreen();
    expect(screen.queryByTestId(`meal-move-${(await mealNamed(services, 'Lunch')).id}`)).toBeNull();
    expect(screen.getByTestId('meal-move-confirm')).toBeDisabled();
    await fireEvent.press(screen.getByTestId(`meal-move-${dinner.id}`));
    await fireEvent.press(screen.getByTestId('meal-move-confirm'));
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect((await services.meals.list()).map((m) => m.name)).toEqual(['Breakfast', 'Dinner', 'Snacks']);
    const day = await services.diary.loadDay('2026-09-25');
    expect(day.meals.find((m) => m.meal.id === dinner.id)?.entries).toHaveLength(1);
  });

  it('UX-17: with only one meal, Delete is disabled with the helper', async () => {
    const { onDone } = await setup(async (s) => {
      const [first, ...rest] = await s.meals.list();
      for (const m of rest) await s.meals.delete(m.id, null);
      return { mode: 'edit', mealId: first!.id };
    });
    expect(await screen.findByText('At least one meal is required.')).toBeOnTheScreen();
    expect(screen.getByTestId('meal-delete')).toBeDisabled();
    expect(onDone).not.toHaveBeenCalled();
  });

  it('UX-00: a deleted or bad meal ID shows not found', async () => {
    await setup(() => ({ mode: 'edit', mealId: 'missing' }));
    expect(await screen.findByTestId('not-found')).toBeOnTheScreen();
  });
});
