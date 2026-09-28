import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import type { AppServices } from '@/bootstrap/services';
import { createTestServices, renderWithServices } from '@/shared/testing/services';

import { MealsScreen } from '../MealsScreen';

async function setup() {
  const { services } = await createTestServices();
  const onEditMeal = jest.fn();
  const onAddMeal = jest.fn();
  await renderWithServices(<MealsScreen onBack={jest.fn()} onAddMeal={onAddMeal} onEditMeal={onEditMeal} />, services);
  await screen.findByTestId('meals-row-3');
  return { services, onEditMeal, onAddMeal };
}

const names = async (services: AppServices) => (await services.meals.list()).map((m) => m.name);

function drag(testId: string, translationY: number) {
  fireGestureHandler(getByGestureTestId(testId), [
    { state: State.BEGAN, translationY: 0 },
    { state: State.ACTIVE, translationY: translationY / 2 },
    { state: State.ACTIVE, translationY },
    { state: State.END, translationY },
  ]);
}

afterEach(async () => {
  await cleanup();
});

describe('UX-17 / NAV-06: Meals', () => {
  it('lists meals in saved order; row tap → edit, `Add meal` → add', async () => {
    const { services, onEditMeal, onAddMeal } = await setup();
    const meals = await services.meals.list();
    expect(screen.getByTestId('meals-row-0')).toHaveTextContent('Breakfast');
    expect(screen.getByTestId('meals-row-3')).toHaveTextContent('Snacks');
    await fireEvent.press(screen.getByTestId('meals-row-1'));
    expect(onEditMeal).toHaveBeenCalledWith(meals[1]!.id);
    await fireEvent.press(screen.getByTestId('meals-add'));
    expect(onAddMeal).toHaveBeenCalledTimes(1);
  });

  it('DS-05 a11y `Move up` / `Move down` reorder and commit immediately (DATA-10, no Save button)', async () => {
    const { services } = await setup();
    const first = screen.getByTestId('meals-row-0');
    expect(first.props.accessibilityActions).toEqual([{ name: 'moveDown', label: 'Move down' }]);
    await fireEvent(first, 'accessibilityAction', { nativeEvent: { actionName: 'moveDown' } });
    await waitFor(async () => expect(await names(services)).toEqual(['Lunch', 'Breakfast', 'Dinner', 'Snacks']));
    await waitFor(() => expect(screen.getByTestId('meals-row-0')).toHaveTextContent('Lunch'));
    const last = screen.getByTestId('meals-row-3');
    expect(last.props.accessibilityActions).toEqual([{ name: 'moveUp', label: 'Move up' }]);
    await fireEvent(last, 'accessibilityAction', { nativeEvent: { actionName: 'moveUp' } });
    await waitFor(async () => expect(await names(services)).toEqual(['Lunch', 'Breakfast', 'Snacks', 'Dinner']));
    expect(screen.queryByText('Save')).toBeNull();
  });

  it('UX-17: a handle drag commits the new order on drop', async () => {
    const { services } = await setup();
    const row = screen.getByTestId('meals-row-0').parent!.parent!;
    await fireEvent(row, 'layout', { nativeEvent: { layout: { height: 52 } } });
    await act(async () => drag('meals-handle-pan-0', 110));
    await waitFor(async () => expect(await names(services)).toEqual(['Lunch', 'Dinner', 'Breakfast', 'Snacks']));
  });

  it('UX-17: a long-press drag on the row reorders and does not open Edit Meal', async () => {
    const { services, onEditMeal } = await setup();
    await act(async () => drag('meals-row-pan-3', -200));
    await waitFor(async () => expect(await names(services)).toEqual(['Snacks', 'Breakfast', 'Lunch', 'Dinner']));
    expect(onEditMeal).not.toHaveBeenCalled();
  });
});
