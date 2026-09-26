import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { router } from 'expo-router';

import type { DiaryEntry } from '@/data/db/repositories/diaryRepository';
import type { Food } from '@/data/db/repositories/foodsRepository';
import { renderWithProviders } from '@/shared/testing/render';

import { FoodDetailScreen } from '../screens/FoodDetailScreen';

const mockAddFoodEntry = jest.fn();
const mockEditFoodEntry = jest.fn();
const mockDeleteEntry = jest.fn();
let mockEntry: DiaryEntry | undefined;
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
  useDiaryEntry: () => ({ data: mockEntry, isError: false }),
  useMeals: () => ({ data: [{ id: 'meal-1', name: 'Breakfast' }] }),
  useDiaryWrites: () => ({
    addFoodEntry: { mutateAsync: mockAddFoodEntry, isPending: false },
    editFoodEntry: { mutateAsync: mockEditFoodEntry, isPending: false },
    deleteEntry: { mutateAsync: mockDeleteEntry, isPending: false },
  }),
}));
jest.mock('../food-search.queries', () => ({
  useFood: (id: string) => ({ data: id ? mockFood : undefined, isError: false }),
  useRecentFoods: () => ({
    data: [{ foodId: mockFood.id, lastServingId: mockFood.servings[0]!.id, lastServingQuantity: 50 }],
  }),
}));

afterEach(() => {
  jest.clearAllMocks();
  mockEntry = undefined;
});

describe('UX-05: Food Detail / Add Entry', () => {
  it('uses the recent serving, exposes an adjustable ruler, and saves the target meal/date', async () => {
    mockAddFoodEntry.mockResolvedValue({ id: 'entry-1' });
    await renderWithProviders(
      <FoodDetailScreen
        mode={{
          kind: 'add',
          foodId: mockFood.id,
          foodSource: 'custom',
          mealId: 'meal-1',
          date: '2026-09-25',
          origin: 'diary',
        }}
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
        mode={{
          kind: 'add',
          foodId: mockFood.id,
          foodSource: 'custom',
          mealId: 'meal-1',
          date: '2026-09-25',
          origin: 'diary',
        }}
      />,
      { language: 'pt-PT' },
    );
    expect(screen.getByRole('header', { name: 'Adicionar alimento' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Adicionar a Breakfast' })).toBeTruthy();
  });

  it('UX-00 / UX-05: submits a direct numeric serving from the keyboard', async () => {
    await renderWithProviders(
      <FoodDetailScreen
        mode={{
          kind: 'add',
          foodId: mockFood.id,
          foodSource: 'custom',
          mealId: 'meal-1',
          date: '2026-09-25',
          origin: 'diary',
        }}
      />,
    );

    fireEvent.press(screen.getByTestId('serving-ruler-value'));
    const input = await screen.findByTestId('serving-value-input');
    fireEvent.changeText(input, '75');
    await waitFor(() => expect(input.props.value).toBe('75'));
    fireEvent(input, 'submitEditing');
    await waitFor(() => expect(screen.getByLabelText('Enter serving value, current value 75')).toBeTruthy());
  });

  it('UX-06: snapshot-only edit scales quantity, hides unit choices, saves, and confirms delete', async () => {
    mockEntry = {
      id: 'entry-1',
      kind: 'food',
      diaryDate: '2026-09-25',
      mealId: 'meal-1',
      foodId: null,
      name: 'Archived oats',
      brand: null,
      servingQuantity: 50,
      servingUnit: 'g',
      nutrients: { energyKcal: 210, carbohydrateG: 30, proteinG: 6, fatG: 7 },
      note: null,
      sortOrder: 0,
    };
    mockEditFoodEntry.mockResolvedValue(mockEntry);
    mockDeleteEntry.mockResolvedValue(undefined);
    await renderWithProviders(<FoodDetailScreen mode={{ kind: 'edit', entryId: 'entry-1', origin: 'diary' }} />);

    expect(screen.getByRole('header', { name: 'Edit entry' })).toBeTruthy();
    expect(screen.queryByTestId('serving-unit-picker')).toBeNull();
    fireEvent(screen.getByRole('adjustable'), 'accessibilityAction', {
      nativeEvent: { actionName: 'increment' },
    });
    await waitFor(() => expect(screen.getByLabelText('Enter serving value, current value 51')).toBeTruthy());
    fireEvent.press(screen.getByTestId('food-entry-save'));
    await waitFor(() =>
      expect(mockEditFoodEntry).toHaveBeenCalledWith({ id: 'entry-1', mealId: 'meal-1', quantity: 51 }),
    );

    fireEvent.press(screen.getByRole('button', { name: 'Delete entry' }));
    const dialog = await screen.findByTestId('food-entry-delete-dialog');
    fireEvent.press(within(dialog).getByRole('button', { name: 'Delete entry' }));
    await waitFor(() => expect(mockDeleteEntry).toHaveBeenCalledWith('entry-1'));
  });
});
