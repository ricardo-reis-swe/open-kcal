import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
import { onlineManager } from '@tanstack/react-query';

import type { CustomFoodInput } from '@/data/db/repositories/foodsRepository';
import type { FoodSearchSections } from '@/domain/food/searchSections';
import { createTestServices, renderWithServices } from '@/shared/testing/services';
import { ProviderConfigurationError, RateLimitError, TimeoutError } from '@/shared/errors';

import { FoodSearchScreen } from '../screens/FoodSearchScreen';

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
    usdaError?: Error;
    usdaCandidates?: { externalId: string; input: CustomFoodInput }[];
    usdaDetail?: { externalId: string; input: CustomFoodInput } | null;
    usdaPageCount?: number;
    offSearch?: () => Promise<{
      candidates: { externalId: string; input: CustomFoodInput }[];
      page: number;
      pageCount: number;
    }>;
    onFoodDatabases?: () => void;
    sections?: FoodSearchSections;
  } = {},
) {
  const { services } = await createTestServices();
  if (options.sections) await services.settings.setFoodSearchSections(options.sections);
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
  const onSelectExternal = jest.fn();
  const onCreateCustom = jest.fn();
  if (options.usdaError) jest.spyOn(services.usda, 'search').mockRejectedValue(options.usdaError);
  else if (options.usdaCandidates)
    jest
      .spyOn(services.usda, 'search')
      .mockResolvedValue({ candidates: options.usdaCandidates, page: 1, pageCount: options.usdaPageCount ?? 1 });
  if (options.offSearch) jest.spyOn(services.openFoodFacts, 'search').mockImplementation(options.offSearch);
  if (options.usdaDetail !== undefined) jest.spyOn(services.usda, 'getFood').mockResolvedValue(options.usdaDetail);
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
      onSelectExternal={onSelectExternal}
      onFoodDatabases={options.onFoodDatabases}
    />,
    services,
    { language: options.language },
  );
  return {
    services,
    food,
    onSelectFood,
    onSelectExternal,
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

  it('UX-04: a saved food is deleted from its revealed Delete button and Undo restores it', async () => {
    const { services } = await setup({ initialQuery: 'almond', withCachedExternal: true });
    const [saved] = await services.foods.searchExternal('cached');
    await screen.findByText('Cached almond yoghurt');
    await act(async () => {
      fireGestureHandler(getByGestureTestId(`food-swipe-${saved!.id}-pan`), [
        { state: State.BEGAN, translationX: 0, velocityX: 0 },
        { state: State.ACTIVE, translationX: -20, velocityX: -200 },
        { state: State.ACTIVE, translationX: -80, velocityX: -200 },
        { state: State.END, translationX: -80, velocityX: -200 },
      ]);
    });
    fireEvent.press(screen.getByTestId(`food-swipe-${saved!.id}-delete`));
    await waitFor(async () => expect(await services.foods.searchExternal('cached')).toEqual([]));
    expect(screen.getByTestId('food-delete-undo')).toHaveTextContent('Cached almond yoghurt deletedUndo');
    fireEvent.press(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(async () =>
      expect(await services.foods.searchExternal('cached')).toEqual([expect.objectContaining({ id: saved!.id })]),
    );
  });

  it('UX-04: custom-food deletion via the accessibility action offers Undo', async () => {
    const { food, services } = await setup({ initialQuery: 'almond' });
    const row = await screen.findByTestId(`food-result-${food.id}`);
    expect(row.props.accessibilityActions).toEqual([{ name: 'delete', label: 'Delete food' }]);
    fireEvent(row, 'accessibilityAction', { nativeEvent: { actionName: 'delete' } });
    await waitFor(async () => expect(await services.foods.searchCustom('almond')).toEqual([]));
    expect(screen.getByTestId('food-delete-undo')).toHaveTextContent('Almond oats deletedUndo');
    fireEvent.press(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(async () =>
      expect(await services.foods.searchCustom('almond')).toEqual([
        expect.objectContaining({ id: food.id, name: 'Almond oats' }),
      ]),
    );
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
    expect(await screen.findByTestId(`food-result-${food.id}`)).toBeTruthy();
    expect(await screen.findByText('Cached almond yoghurt')).toBeTruthy();
  });

  it('UX-04: opens OFF detail immediately without loading the product in the search row', async () => {
    const { services, onSelectExternal, productSignal } = await setup({
      initialQuery: 'yoghurt',
      pendingOffProduct: true,
    });
    fireEvent.press(await screen.findByText('Pending OFF yoghurt'));
    expect(onSelectExternal).toHaveBeenCalledWith('open_food_facts', 'pending-off-product');
    expect(productSignal()).toBeUndefined();
    expect(screen.queryByText('Loading food…')).toBeNull();
    expect(await services.foods.searchExternal('pending')).toEqual([]);
  });

  it('ARCH-22: renders the local search shell in pt-PT', async () => {
    await setup({ language: 'pt-PT' });
    expect(await screen.findByRole('header', { name: 'Pesquisa de alimentos' })).toBeTruthy();
    expect(screen.getByText('A adicionar a Breakfast · Hoje')).toBeTruthy();
    expect(screen.getByText('Pesquise um alimento para o adicionar.')).toBeTruthy();
  });

  it('UX-04: leaves provider detail errors to the detail screen', async () => {
    const { onSelectExternal } = await setup({ initialQuery: 'yoghurt', throttledOffProduct: true });
    fireEvent.press(await screen.findByText('Throttled OFF yoghurt'));
    expect(onSelectExternal).toHaveBeenCalledWith('open_food_facts', 'throttled-off-product');
    expect(screen.queryByText("Couldn't load this food.")).toBeNull();
  });

  it.each([
    ['missing', new ProviderConfigurationError('key state', 'usda_key_missing'), 'Add a USDA API key to search USDA'],
    ['rejected', new ProviderConfigurationError('key state', 'usda_key_rejected'), 'USDA rejected your key.'],
    ['rate limited', new RateLimitError('USDA is rate limited'), 'USDA is busy. Try again later.'],
    ['timeout', new TimeoutError('USDA request timed out'), 'USDA search failed.'],
  ])('PROV-10 / PROV-11: renders the USDA %s state', async (_kind, usdaError, expected) => {
    const onFoodDatabases = jest.fn();
    await setup({ initialQuery: 'eg', usdaError, onFoodDatabases });
    expect(await screen.findByText(expected)).toBeTruthy();
    if (_kind === 'missing' || _kind === 'rejected') {
      await fireEvent.press(screen.getByRole('button', { name: 'Food Databases' }));
      expect(onFoodDatabases).toHaveBeenCalledTimes(1);
    }
    if (_kind === 'timeout') expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
  });

  it('PROV-08 / UX-04: shows generic USDA hits in supplied order and opens detail immediately', async () => {
    const generic: CustomFoodInput = { ...almonds, name: 'Egg, whole, raw', brand: null };
    const branded: CustomFoodInput = { ...almonds, name: 'Eggs brand', brand: 'Brand' };
    const { services, onSelectExternal } = await setup({
      initialQuery: 'eg',
      usdaCandidates: [
        { externalId: 'generic', input: generic },
        { externalId: 'branded', input: branded },
      ],
      usdaDetail: { externalId: 'generic', input: generic },
    });
    expect(await screen.findByText('Egg, whole, raw')).toBeTruthy();
    expect(screen.getByText('Eggs brand')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('food-result-usda-generic'));
    expect(onSelectExternal).toHaveBeenCalledWith('usda', 'generic');
    expect(await services.foods.searchExternal('egg')).toEqual([]);
  });

  it('PROV-08 / UX-04: pages each local section in twenty-row increments', async () => {
    await setup({ initialQuery: 'al', localPaging: true });
    expect(await screen.findByTestId('food-search-custom-show-more')).toBeTruthy();
    expect(screen.getByTestId('food-search-saved-show-more')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('food-search-custom-show-more'));
    await fireEvent.press(screen.getByTestId('food-search-saved-show-more'));
    await waitFor(() => expect(screen.getByText('Al custom 19')).toBeTruthy());
    await waitFor(() => expect(screen.getByText('Al saved 20')).toBeTruthy());
    expect(screen.queryByTestId('food-search-custom-show-more')).toBeNull();
    expect(screen.queryByTestId('food-search-saved-show-more')).toBeNull();
  });

  const hit = (externalId: string, name: string) => ({ externalId, input: { ...almonds, name, brand: null } });

  it('UX-04 / PROV-08: shows Open Food Facts then USDA as separate sections, each with its own Show more', async () => {
    const tenHits = (prefix: string) => Array.from({ length: 10 }, (_, i) => hit(`${prefix}${i}`, `Egg ${prefix}${i}`));
    await setup({
      initialQuery: 'egg',
      usdaCandidates: tenHits('u'),
      usdaPageCount: 3,
      offSearch: async () => ({ candidates: tenHits('o'), page: 1, pageCount: 2 }),
    });
    expect(await screen.findByTestId('food-search-off-show-more', {}, { timeout: 3_000 })).toBeTruthy();
    expect(await screen.findByTestId('food-search-usda-show-more')).toBeTruthy();
    const headers = screen.getAllByRole('header', { name: /^(My foods|Saved|Open Food Facts|USDA)$/ });
    expect(headers.map((node) => node.props.children)).toEqual(['Open Food Facts', 'USDA']);
    expect(screen.getAllByTestId(/^food-result-off-/)).toHaveLength(10);
    expect(screen.getAllByTestId(/^food-result-usda-/)).toHaveLength(10);
  });

  it('PROV-11 / UX-04: a rate-limited OFF section shows its own busy status while USDA still lists hits', async () => {
    await setup({
      initialQuery: 'egg',
      usdaCandidates: [hit('u1', 'Egg, whole, raw')],
      offSearch: () => Promise.reject(new RateLimitError('OFF is rate limited')),
    });
    expect(await screen.findByText('Open Food Facts is busy. Try again later.', {}, { timeout: 3_000 })).toBeTruthy();
    expect(screen.getByText('Egg, whole, raw')).toBeTruthy();
  });
});

describe('UX-18 / DATA-19: Food Search section order and visibility', () => {
  const hit = (externalId: string, name: string) => ({ externalId, input: { ...almonds, name, brand: null } });
  const headerNames = () =>
    screen
      .getAllByRole('header', { name: /^(My foods|Saved|Open Food Facts|USDA)$/ })
      .map((node) => node.props.children);
  const sections = (order: string, hidden: string[] = []) =>
    order.split(',').map((id) => ({ id, visible: !hidden.includes(id) })) as FoodSearchSections;

  it('ROAD-02 M9: hidden remote sections send no requests and render nothing, not even the USDA key status', async () => {
    const offSearch = jest.fn(async () => ({ candidates: [hit('o1', 'Almond OFF')], page: 1, pageCount: 1 }));
    const { services } = await setup({
      initialQuery: 'almond',
      offSearch,
      usdaError: new ProviderConfigurationError('key state', 'usda_key_missing'),
      sections: sections('custom,saved,open_food_facts,usda', ['open_food_facts', 'usda']),
    });
    expect(await screen.findByText('Almond oats')).toBeTruthy();
    await new Promise((resolve) => setTimeout(resolve, 1_000)); // past the 400 ms USDA and 800 ms OFF debounces
    expect(offSearch).not.toHaveBeenCalled();
    expect(services.usda.search).not.toHaveBeenCalled();
    expect(headerNames()).toEqual(['My foods']);
    expect(screen.queryByText('Add a USDA API key to search USDA', { exact: false })).toBeNull();
  });

  it('ROAD-02 M9: renders visible sections in the saved order', async () => {
    await setup({
      initialQuery: 'almond',
      withCachedExternal: true,
      usdaCandidates: [hit('u1', 'Almond USDA')],
      offSearch: async () => ({ candidates: [hit('o1', 'Almond OFF')], page: 1, pageCount: 1 }),
      sections: sections('usda,open_food_facts,saved,custom'),
    });
    expect(await screen.findByText('Almond OFF', {}, { timeout: 3_000 })).toBeTruthy();
    expect(await screen.findByText('Almond USDA')).toBeTruthy();
    expect(headerNames()).toEqual(['USDA', 'Open Food Facts', 'Saved', 'My foods']);
  });

  it('hiding Saved turns off the dedupe, so a cached remote hit shows in its remote section', async () => {
    await setup({
      initialQuery: 'almond',
      withCachedExternal: true,
      offSearch: async () => ({
        candidates: [hit('cached-almonds', 'Cached almond yoghurt')],
        page: 1,
        pageCount: 1,
      }),
      sections: sections('custom,saved,open_food_facts,usda', ['saved']),
    });
    expect(await screen.findByTestId('food-result-off-cached-almonds', {}, { timeout: 3_000 })).toBeTruthy();
    expect(headerNames()).not.toContain('Saved');
  });

  it('No foods found counts only visible sections; offline row only while a remote section is visible', async () => {
    onlineManager.setOnline(false);
    await setup({
      initialQuery: 'almond',
      sections: sections('saved,custom,open_food_facts,usda', ['custom', 'open_food_facts', 'usda']),
    });
    expect(await screen.findByText('No foods found for “almond”.')).toBeTruthy();
    expect(screen.queryByText('Almond oats')).toBeNull();
    expect(screen.queryByText('Offline. Showing saved foods only.')).toBeNull();
  });

  it('shows the offline row once, above the first visible remote section', async () => {
    onlineManager.setOnline(false);
    await setup({ initialQuery: 'almond', sections: sections('usda,custom,open_food_facts,saved') });
    expect(await screen.findByText('Almond oats')).toBeTruthy();
    expect(screen.getAllByText('Offline. Showing saved foods only.')).toHaveLength(1);
  });
});
