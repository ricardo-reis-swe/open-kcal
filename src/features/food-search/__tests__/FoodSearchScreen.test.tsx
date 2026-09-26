import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import type { CustomFoodInput } from '@/data/db/repositories/foodsRepository';
import { createTestServices, renderWithServices } from '@/shared/testing/services';

import { FoodSearchScreen, shouldRevealFoodDelete } from '../screens/FoodSearchScreen';

const almonds: CustomFoodInput = {
  name: 'Almond oats',
  brand: 'Morning Foods',
  basisQuantity: 100,
  basisUnit: 'g',
  nutrients: { energyKcal: 420, carbohydrateG: 60, proteinG: 12, fatG: 14 },
  servings: [{ label: 'g', quantity: 1, unit: 'g', basisMultiplier: 0.01, isDefault: true }],
};

async function setup(options: { withRecent?: boolean; initialQuery?: string; language?: 'en' | 'pt-PT' } = {}) {
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
      initialQuery={options.initialQuery}
      onBack={jest.fn()}
      onQuickCalories={jest.fn()}
      onCreateCustom={onCreateCustom}
      onSelectFood={onSelectFood}
    />,
    services,
    { language: options.language },
  );
  return { services, food, onSelectFood, onCreateCustom };
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

  it('shows custom-food matches for the initial query and selects one', async () => {
    const { food, onSelectFood } = await setup({ initialQuery: 'almond' });
    await waitFor(() => expect(screen.getByTestId(`food-result-${food.id}`)).toBeTruthy());
    fireEvent.press(screen.getByTestId(`food-result-${food.id}`));
    expect(onSelectFood).toHaveBeenCalledWith(expect.objectContaining({ id: food.id }));
  });

  it('UX-04: custom foods expose the swipe threshold and non-gesture Delete food action', async () => {
    const { food } = await setup({ initialQuery: 'almond' });
    const row = await screen.findByTestId(`food-result-${food.id}`);
    expect(shouldRevealFoodDelete(-39)).toBe(false);
    expect(shouldRevealFoodDelete(-40)).toBe(true);
    expect(row.props.accessibilityActions).toEqual([{ name: 'delete', label: 'Delete food' }]);
  });

  it('forwards the current no-results query when creating a custom food', async () => {
    const { onCreateCustom } = await setup({ initialQuery: 'new food' });
    expect(await screen.findByText('No foods found for “new food”.')).toBeTruthy();
    fireEvent.press(screen.getByTestId('food-create-custom'));
    expect(onCreateCustom).toHaveBeenCalledWith('new food');
  });

  it('ARCH-22: renders the local search shell in pt-PT', async () => {
    await setup({ language: 'pt-PT' });
    expect(await screen.findByRole('header', { name: 'Pesquisa de alimentos' })).toBeTruthy();
    expect(screen.getByText('A adicionar a Breakfast · Hoje')).toBeTruthy();
    expect(screen.getByText('Pesquise um alimento para o adicionar.')).toBeTruthy();
  });
});
