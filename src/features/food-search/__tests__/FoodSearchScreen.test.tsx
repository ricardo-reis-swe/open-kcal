import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import type { CustomFoodInput } from '@/data/db/repositories/foodsRepository';
import { createTestServices, renderWithServices } from '@/shared/testing/services';

import { FoodSearchScreen } from '../screens/FoodSearchScreen';

const almonds: CustomFoodInput = {
  name: 'Almond oats',
  brand: 'Morning Foods',
  basisQuantity: 100,
  basisUnit: 'g',
  nutrients: { energyKcal: 420, carbohydrateG: 60, proteinG: 12, fatG: 14 },
  servings: [{ label: 'g', quantity: 1, unit: 'g', basisMultiplier: 0.01, isDefault: true }],
};

async function setup(options: { withRecent?: boolean } = {}) {
  const { services } = await createTestServices();
  const [meal] = await services.meals.list();
  const food = await services.foods.createCustom(almonds);
  if (options.withRecent) {
    await services.diary.addFoodEntry({
      diaryDate: '2026-09-25',
      mealId: meal!.id,
      foodId: food.id,
      servingId: food.servings[0]!.id,
      quantity: 50,
    });
  }
  const onSelectFood = jest.fn();
  const onCreateCustom = jest.fn();
  await renderWithServices(
    <FoodSearchScreen
      mealId={meal!.id}
      date="2026-09-25"
      today="2026-09-25"
      onBack={jest.fn()}
      onQuickCalories={jest.fn()}
      onCreateCustom={onCreateCustom}
      onSelectFood={onSelectFood}
    />,
    services,
  );
  return { food, onSelectFood, onCreateCustom };
}

describe('UX-04: local Food Search screen', () => {
  it('focuses the search field and shows the empty Recent state plus compact actions', async () => {
    await setup();
    expect(await screen.findByText('Search for a food to add it.')).toBeTruthy();
    expect(screen.getByLabelText('Search foods')).toBeTruthy();
    expect(screen.getByText('Adding to Breakfast · Today')).toBeTruthy();
    expect(screen.getByText('Quick calories')).toBeTruthy();
    expect(screen.getByText('Create custom food')).toBeTruthy();
  });

  it('shows hydrated recents and selects one', async () => {
    const { food, onSelectFood } = await setup({ withRecent: true });
    fireEvent.press(await screen.findByTestId(`food-result-${food.id}`));
    expect(onSelectFood).toHaveBeenCalledWith(expect.objectContaining({ id: food.id, name: 'Almond oats' }));
  });

  it('debounces local custom-food search and forwards the query to create', async () => {
    const { food, onSelectFood, onCreateCustom } = await setup();
    const input = await screen.findByTestId('food-search-input');
    fireEvent.changeText(input, 'almond');
    await waitFor(() => expect(screen.getByTestId(`food-result-${food.id}`)).toBeTruthy());
    fireEvent.press(screen.getByTestId(`food-result-${food.id}`));
    expect(onSelectFood).toHaveBeenCalledWith(expect.objectContaining({ id: food.id }));

    fireEvent.changeText(screen.getByTestId('food-search-input'), 'new food');
    await waitFor(() => expect(screen.getByText('No foods found for “new food”.')).toBeTruthy());
    fireEvent.press(screen.getAllByText('Create custom food').at(-1)!);
    expect(onCreateCustom).toHaveBeenCalledWith('new food');
  });
});
