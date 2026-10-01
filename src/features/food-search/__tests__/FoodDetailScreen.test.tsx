import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { router } from 'expo-router';

import type { DiaryEntry } from '@/data/db/repositories/diaryRepository';
import type { Food } from '@/data/db/repositories/foodsRepository';
import { renderWithProviders } from '@/shared/testing/render';

import { FoodDetailScreen } from '../screens/FoodDetailScreen';

const mockAddFoodEntry = jest.fn();
const mockEditFoodEntry = jest.fn();
const mockDeleteEntry = jest.fn();
// Screen flows do not need FlashList's native measurement cycle. The real list's
// scroll configuration and callbacks are covered in ServingRuler.native-scroll.test.tsx.
jest.mock('@shopify/flash-list', () => ({
  AnimatedFlashList: jest.requireActual('react-native').Animated.FlatList,
}));
let mockEntry: DiaryEntry | undefined;
let mockRecent = { foodId: 'food-1', lastServingId: 'serving-1', lastServingQuantity: 50 };
const mockFood: Food = {
  id: 'food-1',
  source: 'custom',
  kind: 'food',
  externalId: null,
  name: 'Almond oats',
  brand: 'Morning Foods',
  basisQuantity: 100,
  basisUnit: 'g',
  nutrients: { energyKcal: 420, carbohydrateG: 60, proteinG: 12, fatG: 14 },
  isDeleted: false,
  barcode: null,
  servings: [
    { id: 'serving-1', label: 'g', quantity: 1, unit: 'g', basisMultiplier: 0.01, isDefault: true, sortOrder: 0 },
    {
      id: 'serving-oz',
      label: 'oz',
      quantity: 1,
      unit: 'oz',
      basisMultiplier: 0.28349523125,
      isDefault: false,
      sortOrder: 1,
    },
  ],
};

// Host-only render tree (RNTL 14): expose KeyboardAvoidingView's `enabled` as a testID.
jest.mock('react-native/Libraries/Components/Keyboard/KeyboardAvoidingView', () => {
  const { createElement } = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    __esModule: true,
    default: ({ enabled, ...props }: { enabled?: boolean }) =>
      createElement(View, { ...props, testID: enabled ? 'kav-enabled' : 'kav-disabled' }),
  };
});
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  router: { back: jest.fn(), dismiss: jest.fn(), dismissTo: jest.fn(), push: jest.fn(), replace: jest.fn() },
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
  useExternalFood: () => ({ data: undefined, isError: false }),
  useRecentFood: () => ({
    data: mockRecent,
    isSuccess: true,
    isError: false,
  }),
}));

afterEach(() => {
  jest.clearAllMocks();
  mockEntry = undefined;
  mockRecent = { foodId: mockFood.id, lastServingId: mockFood.servings[0]!.id, lastServingQuantity: 50 };
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
    expect(screen.getByLabelText('Enter serving value, current value 50 g')).toBeTruthy();
    const ruler = screen.getByTestId('serving-ruler');
    expect(ruler.props.accessibilityRole).toBe('adjustable');
    await fireEvent(ruler, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    await waitFor(() => expect(screen.getByLabelText('Enter serving value, current value 51 g')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('food-detail-add'));
    await waitFor(() =>
      expect(mockAddFoodEntry).toHaveBeenCalledWith({
        diaryDate: '2026-09-25',
        mealId: 'meal-1',
        foodId: 'food-1',
        servingId: 'serving-1',
        quantity: 51,
      }),
    );
    // NAV-04: back to Food Search to log the next food.
    expect(router.back).toHaveBeenCalled();
    expect(router.dismissTo).not.toHaveBeenCalled();
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
    expect(screen.getByRole('button', { name: 'Adicionar' })).toBeTruthy();
  });

  it('UX-05: restores the last saved serving type and amount for a previously used food', async () => {
    mockRecent = { foodId: mockFood.id, lastServingId: 'serving-oz', lastServingQuantity: 2.5 };
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
    expect(await screen.findByLabelText('Enter serving value, current value 2.5 oz')).toBeTruthy();
  });

  it('UX-05: switching serving type keeps the same amount of food (2 nuts → grams → back)', async () => {
    mockFood.servings.push({
      id: 'serving-nut',
      label: 'nut',
      quantity: 1,
      unit: 'nut',
      basisMultiplier: 0.047, // one Brazil nut ≈ 4.7 g
      isDefault: false,
      sortOrder: 2,
    });
    try {
      mockRecent = { foodId: mockFood.id, lastServingId: 'serving-nut', lastServingQuantity: 2 };
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
      expect(await screen.findByLabelText('Enter serving value, current value 2 nut')).toBeTruthy();
      await fireEvent.press(screen.getByRole('button', { name: 'g' }));
      expect(await screen.findByLabelText('Enter serving value, current value 9.4 g')).toBeTruthy();
      await fireEvent.press(screen.getByRole('button', { name: 'oz' }));
      expect(await screen.findByLabelText('Enter serving value, current value 0.33 oz')).toBeTruthy();
      await fireEvent.press(screen.getByRole('button', { name: 'nut' }));
      expect(await screen.findByLabelText('Enter serving value, current value 2 nut')).toBeTruthy();
    } finally {
      mockFood.servings.pop();
    }
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

    await fireEvent.press(screen.getByTestId('serving-ruler-value'));
    const input = await screen.findByTestId('serving-value-input');
    // Done stays above the keypad: the sheet's KeyboardAvoidingView is enabled (primary action above the keyboard).
    expect(within(screen.getByTestId('kav-enabled')).getByTestId('serving-value-confirm')).toBeTruthy();
    await fireEvent.changeText(input, '75');
    await waitFor(() => expect(input.props.value).toBe('75'));
    await fireEvent(input, 'submitEditing');
    await waitFor(() => expect(screen.getByLabelText('Enter serving value, current value 75 g')).toBeTruthy());
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
      createdAt: '2026-09-25T08:00:00.000Z',
      updatedAt: '2026-09-25T08:00:00.000Z',
    };
    mockEditFoodEntry.mockResolvedValue(mockEntry);
    mockDeleteEntry.mockResolvedValue(undefined);
    await renderWithProviders(<FoodDetailScreen mode={{ kind: 'edit', entryId: 'entry-1', origin: 'diary' }} />);

    expect(screen.getByRole('header', { name: 'Edit entry' })).toBeTruthy();
    expect(screen.queryByTestId('serving-unit-picker')).toBeNull();
    await fireEvent(screen.getByRole('adjustable'), 'accessibilityAction', {
      nativeEvent: { actionName: 'increment' },
    });
    await waitFor(() => expect(screen.getByLabelText('Enter serving value, current value 51 g')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('food-entry-save'));
    await waitFor(() =>
      expect(mockEditFoodEntry).toHaveBeenCalledWith({ id: 'entry-1', mealId: 'meal-1', quantity: 51 }),
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Delete entry' }));
    const dialog = await screen.findByTestId('food-entry-delete-dialog');
    await fireEvent.press(within(dialog).getByRole('button', { name: 'Delete entry' }));
    await waitFor(() => expect(mockDeleteEntry).toHaveBeenCalledWith('entry-1'));
  });

  it('UX-05 / DATA-20: Nutrition facts lists the known catalog nutrients by group, scaled to the serving', async () => {
    mockFood.nutrients.extra = { fibre: 10, sodium: 400, salt: 1, vitamin_c: 0.004, caffeine: 0 };
    try {
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
      // Recent serving: 50 g of a per-100 g food.
      const facts = screen.getByTestId('nutrition-facts');
      expect(within(facts).getByRole('header', { name: 'Nutrition facts' })).toBeTruthy();
      expect(within(screen.getByTestId('nutrition-facts-fatsSugars')).getByLabelText('Fibre, 5 grams')).toBeTruthy();
      const minerals = screen.getByTestId('nutrition-facts-minerals');
      expect(within(minerals).getByLabelText('Salt, 0.5 grams')).toBeTruthy();
      expect(within(minerals).getByLabelText('Sodium, 200 milligrams')).toBeTruthy();
      // A known amount too small to show is never rendered as a known zero.
      expect(screen.getByTestId('nutrition-fact-vitamin_c')).toHaveTextContent('Vitamin C<0.1 mg');
      expect(screen.getByTestId('nutrition-fact-caffeine')).toHaveTextContent('Caffeine0 mg');
      expect(screen.queryByTestId('nutrition-fact-iron')).toBeNull();
      await fireEvent(screen.getByTestId('serving-ruler'), 'accessibilityAction', {
        nativeEvent: { actionName: 'increment' },
      });
      await waitFor(() => expect(screen.getByLabelText('Fibre, 5.1 grams')).toBeTruthy());
    } finally {
      delete mockFood.nutrients.extra;
    }
  });

  it('UX-05: a food with no catalog nutrients says so', async () => {
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
    expect(within(screen.getByTestId('nutrition-facts')).getByText('No other nutrients listed.')).toBeTruthy();
  });

  it('UX-06: an edited entry shows its snapshot nutrients, scaled with the quantity', async () => {
    mockEntry = {
      id: 'entry-2',
      kind: 'food',
      diaryDate: '2026-09-25',
      mealId: 'meal-1',
      foodId: null,
      name: 'Archived oats',
      brand: null,
      servingQuantity: 50,
      servingUnit: 'g',
      nutrients: { energyKcal: 210, carbohydrateG: 30, proteinG: 6, fatG: 7, extra: { iron: 2 } },
      note: null,
      sortOrder: 0,
      createdAt: '2026-09-25T08:00:00.000Z',
      updatedAt: '2026-09-25T08:00:00.000Z',
    };
    await renderWithProviders(<FoodDetailScreen mode={{ kind: 'edit', entryId: 'entry-2', origin: 'diary' }} />);
    expect(screen.getByLabelText('Iron, 2 milligrams')).toBeTruthy();
    await fireEvent(screen.getByRole('adjustable'), 'accessibilityAction', {
      nativeEvent: { actionName: 'increment' },
    });
    await waitFor(() => expect(screen.getByLabelText('Iron, 2 milligrams')).toBeTruthy()); // 2.04 → 1 decimal: 2
    expect(screen.getByTestId('nutrition-fact-iron')).toHaveTextContent('Iron2 mg');
  });
});
