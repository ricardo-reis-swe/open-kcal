import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { onlineManager } from '@tanstack/react-query';

import type { CustomFoodInput } from '@/data/db/repositories/foodsRepository';
import { createTestServices, renderWithServices } from '@/shared/testing/services';
import { TimeoutError } from '@/shared/errors';

import { FoodSearchScreen, shouldRevealFoodDelete } from '../screens/FoodSearchScreen';

const almonds: CustomFoodInput = {
  name: 'Almond oats',
  brand: 'Morning Foods',
  basisQuantity: 100,
  basisUnit: 'g',
  nutrients: { energyKcal: 420, carbohydrateG: 60, proteinG: 12, fatG: 14 },
  servings: [{ label: 'g', quantity: 1, unit: 'g', basisMultiplier: 0.01, isDefault: true }],
};

async function setup(
  options: {
    withRecent?: boolean;
    withCachedExternal?: boolean;
    initialQuery?: string;
    language?: 'en' | 'pt-PT';
    throttledOffProduct?: boolean;
    pendingOffProduct?: boolean;
    localPaging?: boolean;
  } = {},
) {
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
  if (options.withCachedExternal) {
    await services.foods.upsertExternal(
      'open_food_facts',
      'cached-almonds',
      {
        name: 'Cached almond yoghurt',
        basisQuantity: 100,
        basisUnit: 'g',
        nutrients: { energyKcal: 100, carbohydrateG: 4, proteinG: 5, fatG: 6 },
        servings: [{ label: 'g', quantity: 1, unit: 'g', basisMultiplier: 0.01 }],
      },
      {
        fetchedAt: '2026-01-01T00:00:00.000Z',
        expiresAt: '2026-01-02T00:00:00.000Z',
        rawPayloadJson: null,
        schemaVersion: 1,
      },
    );
  }
  if (options.localPaging) {
    await Promise.all(
      Array.from({ length: 20 }, (_, index) => services.foods.createCustom({ ...almonds, name: `Al custom ${index}` })),
    );
    await Promise.all(
      Array.from({ length: 21 }, (_, index) =>
        services.foods.upsertExternal(
          'open_food_facts',
          `saved-almond-${index}`,
          { ...almonds, name: `Al saved ${index}` },
          {
            fetchedAt: '2026-01-01T00:00:00.000Z',
            expiresAt: '2026-01-02T00:00:00.000Z',
            rawPayloadJson: null,
            schemaVersion: 1,
          },
        ),
      ),
    );
  }
  const onSelectFood = jest.fn();
  const onCreateCustom = jest.fn();
  if (options.throttledOffProduct) {
    jest.spyOn(services.openFoodFacts, 'search').mockResolvedValue({
      candidates: [
        {
          externalId: 'throttled-off-product',
          input: {
            name: 'Throttled OFF yoghurt',
            brand: null,
            basisQuantity: 100,
            basisUnit: 'g',
            nutrients: { energyKcal: 95, carbohydrateG: 4, proteinG: 8, fatG: 5 },
            servings: [],
          },
        },
      ],
      page: 1,
      pageCount: 1,
    });
    jest.spyOn(services.openFoodFacts, 'getFood').mockRejectedValue(new TimeoutError('budget wait timed out'));
  }
  let resolvePendingProduct: (() => void) | undefined;
  let productSignal: AbortSignal | undefined;
  if (options.pendingOffProduct) {
    jest.spyOn(services.openFoodFacts, 'search').mockResolvedValue({
      candidates: [
        {
          externalId: 'pending-off-product',
          input: {
            name: 'Pending OFF yoghurt',
            brand: null,
            basisQuantity: 100,
            basisUnit: 'g',
            nutrients: { energyKcal: 95, carbohydrateG: 4, proteinG: 8, fatG: 5 },
            servings: [],
          },
        },
      ],
      page: 1,
      pageCount: 1,
    });
    jest.spyOn(services.openFoodFacts, 'getFood').mockImplementation(
      (_id, signal) =>
        new Promise((resolve) => {
          productSignal = signal;
          resolvePendingProduct = () => resolve(null);
        }),
    );
  }
  const view = await renderWithServices(
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
  return {
    services,
    food,
    onSelectFood,
    onCreateCustom,
    view,
    productSignal: () => productSignal,
    resolvePendingProduct,
  };
}

afterEach(async () => {
  await cleanup();
  onlineManager.setOnline(true);
  jest.restoreAllMocks();
});

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

  it('UX-04: custom foods expose the swipe threshold and Delete food accessibility action', async () => {
    const { food, services } = await setup({ initialQuery: 'almond' });
    const row = await screen.findByTestId(`food-result-${food.id}`);
    expect(shouldRevealFoodDelete(-39)).toBe(false);
    expect(shouldRevealFoodDelete(-40)).toBe(true);
    expect(row.props.accessibilityActions).toEqual([{ name: 'delete', label: 'Delete food' }]);
    fireEvent(row, 'accessibilityAction', { nativeEvent: { actionName: 'delete' } });
    await waitFor(async () => expect(await services.foods.searchCustom('almond')).toEqual([]));
  });

  it('forwards the current no-results query when creating a custom food', async () => {
    const { onCreateCustom } = await setup({ initialQuery: 'new food' });
    expect(await screen.findByText('No foods found for “new food”.')).toBeTruthy();
    fireEvent.press(screen.getByTestId('food-create-custom'));
    expect(onCreateCustom).toHaveBeenCalledWith('new food');
  });

  it('ARCH-12 / UX-04: keeps local search available and reports the remote section as offline', async () => {
    onlineManager.setOnline(false);
    const { food } = await setup({ initialQuery: 'almond', withCachedExternal: true });
    expect(await screen.findByText('Offline. Showing saved foods only.')).toBeTruthy();
    expect(screen.getByTestId(`food-result-${food.id}`)).toBeTruthy();
    expect(screen.getByText('Cached almond yoghurt')).toBeTruthy();
  });

  it('PROV-10 / UX-04: aborts a selected OFF detail on unmount and never upserts or navigates', async () => {
    const { services, onSelectFood, productSignal, view, resolvePendingProduct } = await setup({
      initialQuery: 'yoghurt',
      pendingOffProduct: true,
    });
    fireEvent.press(await screen.findByText('Pending OFF yoghurt'));
    await waitFor(() => expect(productSignal()).toBeDefined());
    view.unmount();
    await waitFor(() => expect(productSignal()!.aborted).toBe(true));
    resolvePendingProduct?.();
    await Promise.resolve();
    expect(onSelectFood).not.toHaveBeenCalled();
    expect(await services.foods.searchExternal('pending')).toEqual([]);
  });

  it('ARCH-22: renders the local search shell in pt-PT', async () => {
    await setup({ language: 'pt-PT' });
    expect(await screen.findByRole('header', { name: 'Pesquisa de alimentos' })).toBeTruthy();
    expect(screen.getByText('A adicionar a Breakfast · Hoje')).toBeTruthy();
    expect(screen.getByText('Pesquise um alimento para o adicionar.')).toBeTruthy();
  });

  it('PROV-04 / UX-04: shows the row error when a throttled OFF product read reaches its five-second bound', async () => {
    await setup({ initialQuery: 'yoghurt', throttledOffProduct: true });
    fireEvent.press(await screen.findByText('Throttled OFF yoghurt'));
    const row = await screen.findByTestId('food-result-off-throttled-off-product');
    expect(await within(row).findByText("Couldn't load this food.")).toBeTruthy();
  });

  it('PROV-08 / UX-04: pages each local section in twenty-row increments', async () => {
    await setup({ initialQuery: 'al', localPaging: true });
    expect(await screen.findByTestId('food-search-custom-show-more')).toBeTruthy();
    expect(screen.getByTestId('food-search-saved-show-more')).toBeTruthy();
    fireEvent.press(screen.getByTestId('food-search-custom-show-more'));
    fireEvent.press(screen.getByTestId('food-search-saved-show-more'));
    await waitFor(() => expect(screen.getByText('Al custom 19')).toBeTruthy());
    expect(screen.getByText('Al saved 20')).toBeTruthy();
    expect(screen.queryByTestId('food-search-custom-show-more')).toBeNull();
    expect(screen.queryByTestId('food-search-saved-show-more')).toBeNull();
  });
});
