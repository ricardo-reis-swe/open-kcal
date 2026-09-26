import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import type { Food } from '@/data/db/repositories/foodsRepository';
import { renderWithProviders } from '@/shared/testing/render';

import { FoodDetailScreen } from '../screens/FoodDetailScreen';

const mockAddFoodEntry = jest.fn();
const mockFood: Food = {
  id: 'food-1',
  source: 'custom',
  externalId: null,
  name: 'Almond oats',
  brand: 'Morning Foods',
  basisQuantity: 100,
  basisUnit: 'g',
  nutrients: { energyKcal: 420, carbohydrateG: 60, proteinG: 12, fatG: 14 },
  isDeleted: false,
  servings: [
    { id: 'serving-1', label: 'g', quantity: 1, unit: 'g', basisMultiplier: 0.01, isDefault: true, sortOrder: 0 },
  ],
};

jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  router: { back: jest.fn(), dismissTo: jest.fn(), push: jest.fn(), replace: jest.fn() },
}));
jest.mock('@/features/diary/hooks/DiaryDateContext', () => ({
  useDiaryDate: () => ({ today: '2026-09-25', date: '2026-09-25', setDate: jest.fn() }),
}));
jest.mock('@/features/diary/diary.queries', () => ({
  useAppSettings: () => ({ data: { energyUnit: 'kcal', foodWeightUnit: 'g', volumeUnit: 'ml' } }),
  useMeals: () => ({ data: [{ id: 'meal-1', name: 'Breakfast' }] }),
  useDiaryWrites: () => ({ addFoodEntry: { mutateAsync: mockAddFoodEntry, isPending: false } }),
}));
jest.mock('../food-search.queries', () => ({
  useFood: () => ({ data: mockFood }),
  useRecentFoods: () => ({
    data: [{ foodId: mockFood.id, lastServingId: mockFood.servings[0]!.id, lastServingQuantity: 50 }],
  }),
}));

afterEach(() => jest.clearAllMocks());

describe('UX-05: Food Detail / Add Entry', () => {
  it('uses the recent serving, exposes an adjustable ruler, and saves the target meal/date', async () => {
    mockAddFoodEntry.mockResolvedValue({ id: 'entry-1' });
    await renderWithProviders(
      <FoodDetailScreen
        mode={{ foodId: mockFood.id, foodSource: 'custom', mealId: 'meal-1', date: '2026-09-25', origin: 'diary' }}
      />,
    );

    expect(screen.getByRole('header', { name: 'Add food' })).toBeTruthy();
    expect(screen.getByLabelText('Enter serving value, current value 50')).toBeTruthy();
    const ruler = screen.getByTestId('serving-ruler');
    expect(ruler.props.accessibilityRole).toBe('adjustable');
    fireEvent(ruler, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    await waitFor(() => expect(screen.getByLabelText('Enter serving value, current value 51')).toBeTruthy());

    fireEvent.press(screen.getByTestId('food-detail-add'));
    await waitFor(() =>
      expect(mockAddFoodEntry).toHaveBeenCalledWith({
        diaryDate: '2026-09-25',
        mealId: 'meal-1',
        foodId: 'food-1',
        servingId: 'serving-1',
        quantity: 51,
      }),
    );
    expect(router.dismissTo).toHaveBeenCalledWith('/diary');
  });

  it('ARCH-22: renders the key add-entry controls in pt-PT', async () => {
    await renderWithProviders(
      <FoodDetailScreen
        mode={{ foodId: mockFood.id, foodSource: 'custom', mealId: 'meal-1', date: '2026-09-25', origin: 'diary' }}
      />,
      { language: 'pt-PT' },
    );
    expect(screen.getByRole('header', { name: 'Adicionar alimento' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Adicionar a Breakfast' })).toBeTruthy();
  });
});
