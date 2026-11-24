import { useEffect, useRef, useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { SectionList, StyleSheet, TextInput, View } from 'react-native';

import type { Food } from '@/data/db/repositories/foodsRepository';
import { matchesFoodQuery } from '@/domain/food/foodQuery';
import {
  REMOTE_FOOD_SEARCH_SECTIONS,
  visibleFoodSearchSections,
  type FoodSearchSectionId,
} from '@/domain/food/searchSections';
import { useServices } from '@/bootstrap/services';
import { ProviderConfigurationError, RateLimitError } from '@/shared/errors';
import { useAppSettings, useDiaryWrites, useMeals } from '@/features/diary/diary.queries';
import { useUsdaKeyConfigured } from '@/features/profile/profile.queries';
import {
  AppBar,
  AppText,
  InlineStatus,
  PressableIcon,
  PrimaryButton,
  SectionHeader,
  TabStrip,
  TextAction,
  UndoToast,
} from '@/shared/components';
import type { LocalDate } from '@/shared/dates';
import { formatShortDate, relativeDay } from '@/shared/i18n/format';
import { useFormattingLocale } from '@/shared/i18n/useFormattingLocale';
import { useTheme } from '@/shared/theme';

import { clearAddedFood, useAddedFoodNotice } from '../addedNotice';
import { FoodResultRow } from '../components/FoodResultRow';
import {
  useCustomFoodList,
  useCustomFoodSearch,
  useFoodSearchSections,
  useLocalFoodWrites,
  useOpenFoodFactsSearch,
  useOnlineStatus,
  useRecentFoods,
  useRecipeList,
  useRecipeSearch,
  refreshSavedFood,
  useSavedFoodSearch,
  useUsdaSearch,
} from '../food-search.queries';

const LOCAL_DEBOUNCE_MS = 150;
const OFF_DEBOUNCE_MS = 800;
const USDA_DEBOUNCE_MS = 800;

/** UX-04 tabs. `all` is the sectioned search; the others are local lists that never call a provider. */
type SearchTab = 'all' | 'recent' | 'custom' | 'recipes';

/** UX-04 select mode: Back (system back, swipe-back) while it's on leaves select mode instead of the screen. */
export type SelectBackGuard = (enabled: boolean, onAttempt: () => void) => void;
const noBackGuard: SelectBackGuard = () => {};

/** ARCH-19: Food Search is one virtualized SectionList over these rows (heavy food rows typed, status rows as nodes). */
type RowProps = { onPress: () => void; onDelete?: () => Promise<boolean>; selected?: boolean; dimmed?: boolean };
type SearchRow =
  { kind: 'food'; key: string; food: Food; rowProps: RowProps } | { kind: 'node'; key: string; node: ReactElement };
type SearchSection = { key: string; header?: string; data: SearchRow[] };

type Props = {
  mealId: string;
  date: LocalDate;
  today: LocalDate;
  initialQuery?: string;
  /** False when opened for NAV-03 Scan Barcode (the scanner is pushed on top). */
  autoFocus?: boolean;
  onBack: () => void;
  /** UX-04 scan icon → Barcode Scanner (UX-24). */
  onScan: () => void;
  onQuickCalories: () => void;
  onCreateCustom: (initialName: string) => void;
  onFoodDatabases?: () => void;
  onSelectFood: (food: Food) => void;
  onSelectExternal: (source: 'usda' | 'open_food_facts', externalId: string) => void;
  /** UX-04 select mode `Add to <meal>` committed (NAV-04: → Diary on the target date). */
  onAddedSelection: () => void;
  useSelectBackGuard?: SelectBackGuard;
  /** UX-04 `Recipes` tab `Create recipe` → Create Recipe (UX-26), `initialName` = current query. */
  onCreateRecipe?: (initialName: string) => void;
  /**
   * UX-04 ingredient mode (Ingredient Search over a UX-26 editor): tabs All · Recent · My foods, recipes excluded, no
   * ⚡ / select mode / create / swipe-delete. `mealId` and `date` are unused. `ingredientScan` (POST-15) restores the
   * scan icon when the stack can open the Barcode Scanner (Diary only).
   */
  ingredientFor?: { recipeName: string };
  /** POST-15: show the scan icon in ingredient mode (the Diary stack's scanner writes into the draft). */
  ingredientScan?: boolean;
};

/** UX-04 M4 subset: focused search, Recents without a query, and local custom-food results after 150 ms. */
export function FoodSearchScreen({
  mealId,
  date,
  today,
  initialQuery = '',
  autoFocus = true,
  onBack,
  onScan,
  onQuickCalories,
  onCreateCustom,
  onSelectFood,
  onSelectExternal,
  onFoodDatabases,
  onAddedSelection,
  useSelectBackGuard = noBackGuard,
  onCreateRecipe,
  ingredientFor,
  ingredientScan = false,
}: Props) {
  const ingredientMode = ingredientFor !== undefined;
  const { t, i18n } = useTranslation();
  const locale = useFormattingLocale();
  const theme = useTheme();
  const meals = useMeals();
  const settings = useAppSettings();
  const recents = useRecentFoods();
  const writes = useLocalFoodWrites();
  const services = useServices();
  const [deleteFailed, setDeleteFailed] = useState(false);
  const [deletedFood, setDeletedFood] = useState<Food | null>(null);
  const added = useAddedFoodNotice();
  // A notice belongs to this visit of search; leaving it drops a toast that hasn't shown yet.
  useEffect(() => () => void (added && clearAddedFood(added.key)), [added]);
  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery.trim());
  const [offQuery, setOffQuery] = useState(initialQuery.trim());
  const [usdaQuery, setUsdaQuery] = useState(initialQuery.trim());
  const [offPages, setOffPages] = useState(1);
  const [customPages, setCustomPages] = useState(1);
  const [recipePages, setRecipePages] = useState(1);
  const [savedPages, setSavedPages] = useState(1);
  const [usdaPages, setUsdaPages] = useState(1);
  const [tab, setTab] = useState<SearchTab>('all');
  // UX-04 select mode: stored foods in tap order, kept across tabs and query changes.
  const [selecting, setSelecting] = useState(false);
  const [selection, setSelection] = useState<Food[]>([]);
  const [addFailed, setAddFailed] = useState(false);
  const diaryWrites = useDiaryWrites();
  const leaveSelectMode = () => {
    setSelecting(false);
    setSelection([]);
    setAddFailed(false);
  };
  useSelectBackGuard(selecting, leaveSelectMode);
  // NAV-04: after a select-mode add, leave only once select mode is off, so the back guard lets the exit through.
  const [addedSelection, setAddedSelection] = useState(false);
  const leftAfterAdd = useRef(false);
  useEffect(() => {
    if (!addedSelection || leftAfterAdd.current) return;
    leftAfterAdd.current = true;
    onAddedSelection();
  }, [addedSelection, onAddedSelection]);
  useEffect(() => {
    if (query.trim() === debouncedQuery) return;
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), LOCAL_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [debouncedQuery, query]);
  useEffect(() => {
    if (query.trim() === offQuery) return;
    const timer = setTimeout(() => setOffQuery(query.trim()), OFF_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [offQuery, query]);
  useEffect(() => {
    if (query.trim() === usdaQuery) return;
    const timer = setTimeout(() => setUsdaQuery(query.trim()), USDA_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [usdaQuery, query]);
  // DATA-19 / UX-18: until the setting loads nothing is visible, so a hidden remote section never sends a request.
  const sections = useFoodSearchSections();
  // UX-18: without a USDA key its switch reads off, so the section is hidden here too (no key-missing row, no request).
  const usdaAvailable = useUsdaKeyConfigured().data === true;
  const visibleSections = sections.data
    ? visibleFoodSearchSections(sections.data).filter((id) => id !== 'usda' || usdaAvailable)
    : [];
  // UX-04: only `All` follows UX-18 visibility and searches providers; `My foods` always lists custom foods.
  const shows = (id: FoodSearchSectionId) => tab === 'all' && visibleSections.includes(id);
  const custom = useCustomFoodSearch(debouncedQuery, customPages, shows('custom') || tab === 'custom');
  const customList = useCustomFoodList(customPages, tab === 'custom' && debouncedQuery.length === 0);
  const recipeList = useRecipeList(recipePages, tab === 'recipes' && debouncedQuery.length === 0);
  const recipeSearch = useRecipeSearch(debouncedQuery, recipePages, tab === 'recipes');
  const saved = useSavedFoodSearch(debouncedQuery, savedPages, shows('saved'));
  const off = useOpenFoodFactsSearch(
    offQuery,
    offPages,
    i18n.resolvedLanguage ?? i18n.language,
    shows('open_food_facts'),
  );
  const usda = useUsdaSearch(usdaQuery, usdaPages, shows('usda'));
  const online = useOnlineStatus();
  const meal = meals.data?.find((candidate) => candidate.id === mealId);
  if ((!meal && !ingredientMode) || !settings.data || !sections.data) return null;
  const relative = relativeDay(date, today);
  const dateLabel = relative ? t(`diary.${relative}`) : formatShortDate(date, today, locale);
  const hasQuery = query.trim().length > 0;
  const searching = hasQuery && query.trim() !== debouncedQuery;
  // POST-15: recipes are never ingredients, so ingredient mode leaves them out of Recents too.
  const recentFoods = (recents.data ?? [])
    .map(({ food }) => food)
    .filter((food) => !ingredientMode || food.kind !== 'recipe');
  const searchedCustom = shows('custom') ? (custom.data ?? []) : [];
  // UX-04 / DATA-28: on `All` a recipe shows only while it is in Recents, inside the `My foods` section.
  const recentRecipes =
    shows('custom') && !ingredientMode
      ? recentFoods.filter((food) => food.kind === 'recipe' && matchesFoodQuery(food, debouncedQuery))
      : [];
  const customFoods = [...searchedCustom, ...recentRecipes];
  // UX-18: while `Saved` is hidden there is no PROV-08 dedupe, so cached remote hits show in their remote section.
  const savedFoods = shows('saved') ? (saved.data ?? []) : [];
  const savedExternalIds = new Set(
    savedFoods.filter((food) => food.source === 'open_food_facts' && food.externalId).map((food) => food.externalId!),
  );
  const offFoods = shows('open_food_facts')
    ? off.data.filter((candidate) => !savedExternalIds.has(candidate.externalId))
    : [];
  const usdaFoods = (shows('usda') ? usda.data : []).filter(
    (candidate) => !savedFoods.some((food) => food.source === 'usda' && food.externalId === candidate.externalId),
  );
  const updateQuery = (value: string) => {
    if (value.trim() !== offQuery) {
      setOffPages(1);
      setCustomPages(1);
      setRecipePages(1);
      setSavedPages(1);
      setUsdaPages(1);
    }
    setQuery(value);
  };
  const chooseTab = (next: SearchTab) => {
    setCustomPages(1);
    setRecipePages(1);
    setTab(next);
  };
  const leaveSearch = () => {
    if (selecting) leaveSelectMode();
    else onBack();
  };
  const toggleSelected = (food: Food) =>
    setSelection((current) =>
      current.some((item) => item.id === food.id) ? current.filter((item) => item.id !== food.id) : [...current, food],
    );
  /** UX-04: a stored row opens Food Detail and swipe-deletes, or toggles its selection in select mode. */
  const storedRowProps = (food: Food, open: () => void, onDelete?: () => Promise<boolean>) =>
    selecting
      ? { selected: selection.some((item) => item.id === food.id), onPress: () => toggleSelected(food) }
      : { onPress: open, onDelete: ingredientMode ? undefined : onDelete };
  const addSelection = async () => {
    setAddFailed(false);
    try {
      await diaryWrites.addFoodEntries.mutateAsync({
        diaryDate: date,
        mealId,
        foodIds: selection.map((food) => food.id),
      });
      setSelecting(false);
      setSelection([]);
      setAddedSelection(true);
    } catch {
      setAddFailed(true);
    }
  };
  const deleteFood = async (food: Food): Promise<boolean> => {
    setDeleteFailed(false);
    try {
      await writes.deleteFood.mutateAsync(food.id);
      setDeletedFood(food);
      return true;
    } catch {
      setDeleteFailed(true);
      return false;
    }
  };
  const undoDelete = async () => {
    if (!deletedFood) return;
    try {
      await writes.restoreFood.mutateAsync(deletedFood.id);
      setDeletedFood(null);
    } catch {
      setDeletedFood(null);
      setDeleteFailed(true);
    }
  };
  // UX-18: the offline row shows once, above the first visible remote section, only while one is visible.
  const firstVisibleRemote = visibleSections.find((id) => REMOTE_FOOD_SEARCH_SECTIONS.includes(id));
  const remoteLoading = (shows('open_food_facts') && off.isLoading) || (shows('usda') && usda.isLoading);
  const padded = { paddingHorizontal: theme.spacing[4] };
  const energyUnit = settings.data.energyUnit;
  const foodRow = (food: Food, rowProps: RowProps, key: string = food.id): SearchRow => ({
    kind: 'food',
    key,
    food,
    rowProps,
  });
  const nodeRow = (key: string, node: ReactElement): SearchRow => ({ kind: 'node', key, node });
  const searchingNode = (key: string) =>
    nodeRow(
      key,
      <AppText color="textSecondary" style={padded}>
        {t('foodSearch.searching')}
      </AppText>,
    );
  const noResultsNode = (key: string) =>
    nodeRow(key, <AppText style={padded}>{t('foodSearch.noResults', { query: query.trim() })}</AppText>);
  const showMoreNode = (key: string, testID: string, onPress: () => void) =>
    nodeRow(key, <TextAction icon="add" label={t('foodSearch.showMore')} onPress={onPress} testID={testID} />);
  const remoteFood = (
    source: 'usda' | 'open_food_facts',
    candidate: (typeof offFoods)[number] | (typeof usdaFoods)[number],
  ): SearchRow => {
    const id = `${source === 'usda' ? 'usda' : 'off'}-${candidate.externalId}`;
    return foodRow(
      {
        ...candidate.input,
        kind: 'food',
        brand: candidate.input.brand ?? null,
        barcode: candidate.input.barcode ?? null,
        id,
        source,
        externalId: candidate.externalId,
        isDeleted: false,
        servings: [],
      },
      { dimmed: selecting, onPress: () => onSelectExternal(source, candidate.externalId) },
      id,
    );
  };
  const recentRowProps = (food: Food) =>
    storedRowProps(
      food,
      () => {
        void refreshSavedFood(services, food); // PROV-09: Recent opens refresh too
        onSelectFood(food);
      },
      () => deleteFood(food),
    );
  const recentRow = (food: Food) => foodRow(food, recentRowProps(food));
  const plainRow = (food: Food) =>
    foodRow(
      food,
      storedRowProps(
        food,
        () => onSelectFood(food),
        () => deleteFood(food),
      ),
    );
  const sectionData: Record<FoodSearchSectionId, SearchSection> = {
    custom: {
      key: 'custom',
      header: customFoods.length > 0 ? t('foodSearch.myFoods') : undefined,
      data: [
        ...customFoods.map((food) =>
          foodRow(
            food,
            storedRowProps(
              food,
              () => onSelectFood(food),
              food.source === 'custom' ? () => deleteFood(food) : undefined,
            ),
          ),
        ),
        ...(searchedCustom.length === customPages * 20
          ? [
              showMoreNode('custom-show-more', 'food-search-custom-show-more', () =>
                setCustomPages((current) => current + 1),
              ),
            ]
          : []),
      ],
    },
    saved: {
      key: 'saved',
      header: savedFoods.length > 0 ? t('foodSearch.saved') : undefined,
      data: [
        ...savedFoods.map(recentRow),
        ...(savedFoods.length === savedPages * 20
          ? [
              showMoreNode('saved-show-more', 'food-search-saved-show-more', () =>
                setSavedPages((current) => current + 1),
              ),
            ]
          : []),
      ],
    },
    open_food_facts: {
      key: 'open_food_facts',
      header: query.trim().length >= 3 ? t('foodSearch.openFoodFacts') : undefined,
      data: [
        ...(query.trim().length >= 3 && query.trim() !== offQuery ? [searchingNode('off-searching-typing')] : []),
        ...(online && off.isLoading && query.trim() === offQuery ? [searchingNode('off-searching-loading')] : []),
        ...(off.isError
          ? [
              nodeRow(
                'off-error',
                <ProviderError provider="open_food_facts" error={off.error} onRetry={() => void off.refetch()} />,
              ),
            ]
          : []),
        ...offFoods.map((candidate) => remoteFood('open_food_facts', candidate)),
        ...(off.hasMore && query.trim() === offQuery
          ? [showMoreNode('off-show-more', 'food-search-off-show-more', () => setOffPages((current) => current + 1))]
          : []),
        ...(off.isSuccess && query.trim() === offQuery && offFoods.length === 0
          ? [
              nodeRow(
                'off-no-results',
                <AppText color="textSecondary" style={padded}>
                  {t('foodSearch.providerNoResults', { provider: t('foodSearch.openFoodFacts') })}
                </AppText>,
              ),
            ]
          : []),
      ],
    },
    usda: {
      key: 'usda',
      header: query.trim().length >= 2 ? t('foodSearch.usda') : undefined,
      data: [
        ...(query.trim().length >= 2 && usdaQuery !== query.trim() ? [searchingNode('usda-searching-typing')] : []),
        ...(online && usda.isLoading ? [searchingNode('usda-searching-loading')] : []),
        ...(usda.isError
          ? [
              nodeRow(
                'usda-error',
                <ProviderError
                  provider="usda"
                  error={usda.error}
                  onRetry={() => void usda.refetch()}
                  onFoodDatabases={onFoodDatabases}
                />,
              ),
            ]
          : []),
        ...usdaFoods.map((candidate) => remoteFood('usda', candidate)),
        ...(usda.hasMore && usdaQuery === query.trim()
          ? [showMoreNode('usda-show-more', 'food-search-usda-show-more', () => setUsdaPages((current) => current + 1))]
          : []),
        ...(usda.isSuccess && usdaQuery === query.trim() && usdaFoods.length === 0
          ? [
              nodeRow(
                'usda-no-results',
                <AppText color="textSecondary" style={padded}>
                  {t('foodSearch.providerNoResults', { provider: t('foodSearch.usda') })}
                </AppText>,
              ),
            ]
          : []),
      ],
    },
  };

  // UX-04 Recent tab: the ≤20 Recents (DATA-14), filtered in memory with the PROV-08 token rule.
  const recentTabData: SearchRow[] = searching
    ? [searchingNode('tab-recent-searching')]
    : recentFoods.length === 0
      ? [
          nodeRow(
            'tab-recent-empty',
            <AppText color="textSecondary" style={padded}>
              {t('foodSearch.emptyRecentTab')}
            </AppText>,
          ),
        ]
      : hasQuery && !recentFoods.some((food) => matchesFoodQuery(food, debouncedQuery))
        ? [noResultsNode('tab-recent-no-results')]
        : recentFoods.filter((food) => matchesFoodQuery(food, debouncedQuery)).map(recentRow);
  // UX-04 My foods tab: every custom food (DATA-25) without a query; the PROV-08 custom search with one.
  const myFoods = (hasQuery ? custom.data : customList.data) ?? [];
  const myFoodsLoaded = hasQuery ? custom.isSuccess : customList.isSuccess;
  const customTabData: SearchRow[] = [
    // UX-04: `Create custom food` lives on this tab only, always first (initialName = current query).
    ...(selecting || ingredientMode
      ? []
      : [
          nodeRow(
            'custom-create',
            <View style={padded}>
              <TextAction
                icon="add"
                label={t('foodSearch.createCustom')}
                onPress={() => onCreateCustom(query.trim())}
                testID="food-create-custom"
              />
            </View>,
          ),
        ]),
    ...(searching
      ? [searchingNode('tab-custom-searching')]
      : !myFoodsLoaded
        ? []
        : myFoods.length === 0
          ? [
              hasQuery
                ? noResultsNode('tab-custom-no-results')
                : nodeRow(
                    'tab-custom-empty',
                    <AppText color="textSecondary" style={padded}>
                      {t('foodSearch.emptyCustom')}
                    </AppText>,
                  ),
            ]
          : [
              ...myFoods.map(plainRow),
              ...(myFoods.length === customPages * 20
                ? [
                    showMoreNode('tab-custom-show-more', 'food-search-custom-show-more', () =>
                      setCustomPages((current) => current + 1),
                    ),
                  ]
                : []),
            ]),
  ];
  // UX-04 Recipes tab: every recipe (DATA-28 order) without a query; `searchRecipes` with one.
  const recipes = (hasQuery ? recipeSearch.data : recipeList.data) ?? [];
  const recipesLoaded = hasQuery ? recipeSearch.isSuccess : recipeList.isSuccess;
  const recipesTabData: SearchRow[] = [
    ...(selecting
      ? []
      : [
          nodeRow(
            'recipes-create',
            <View style={padded}>
              <TextAction
                icon="add"
                label={t('foodSearch.createRecipe')}
                onPress={() => onCreateRecipe?.(query.trim())}
                testID="food-create-recipe"
              />
            </View>,
          ),
        ]),
    ...(searching
      ? [searchingNode('tab-recipes-searching')]
      : !recipesLoaded
        ? []
        : recipes.length === 0
          ? [
              hasQuery
                ? noResultsNode('tab-recipes-no-results')
                : nodeRow(
                    'tab-recipes-empty',
                    <AppText color="textSecondary" style={padded}>
                      {t('foodSearch.emptyRecipes')}
                    </AppText>,
                  ),
            ]
          : [
              ...recipes.map(plainRow),
              ...(recipes.length === recipePages * 20
                ? [
                    showMoreNode('tab-recipes-show-more', 'food-search-recipes-show-more', () =>
                      setRecipePages((current) => current + 1),
                    ),
                  ]
                : []),
            ]),
  ];

  // ARCH-19: one virtualized SectionList; every body below is a list of sections over typed rows.
  const listSections: SearchSection[] = [];
  if (tab === 'recent') listSections.push({ key: 'tab-recent', data: recentTabData });
  else if (tab === 'custom') listSections.push({ key: 'tab-custom', data: customTabData });
  else if (tab === 'recipes') listSections.push({ key: 'tab-recipes', data: recipesTabData });
  else if (hasQuery) {
    if (searching) listSections.push({ key: 'searching', data: [searchingNode('searching')] });
    else {
      for (const id of visibleSections) {
        if (id === firstVisibleRemote && !online) {
          // Header-less, so it stays above the remote section's sticky label.
          listSections.push({
            key: 'offline',
            data: [nodeRow('offline', <InlineStatus tone="info" message={t('foodSearch.offline')} />)],
          });
        }
        const section = sectionData[id];
        if (section.header !== undefined || section.data.length > 0) listSections.push(section);
      }
      if (
        customFoods.length === 0 &&
        savedFoods.length === 0 &&
        offFoods.length === 0 &&
        usdaFoods.length === 0 &&
        !remoteLoading
      )
        listSections.push({ key: 'no-results', data: [noResultsNode('no-results')] });
    }
  } else {
    listSections.push({
      key: 'recent',
      header: t('foodSearch.recent'),
      data:
        recentFoods.length > 0
          ? recentFoods.map(recentRow)
          : [
              nodeRow(
                'recent-empty',
                <AppText color="textSecondary" style={padded}>
                  {t('foodSearch.emptyRecent')}
                </AppText>,
              ),
            ],
    });
  }
  const renderRow = ({ item }: { item: SearchRow }) =>
    item.kind === 'node' ? (
      item.node
    ) : (
      <FoodResultRow food={item.food} locale={locale} energyUnit={energyUnit} {...item.rowProps} />
    );
  // The three tab bodies had a spacer above them (the former `paddingTop` wrapper).
  const listHeader = (
    <>
      {/* UX-04: the select-mode toggle, then quick calories ⚡, trail the meal/date context line. */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingLeft: theme.spacing[4],
          paddingRight: theme.spacing[2],
          paddingTop: theme.spacing[1],
        }}
      >
        <AppText variant="compact" color="textSecondary" style={{ flex: 1 }} testID="food-search-context">
          {ingredientFor
            ? ingredientFor.recipeName
              ? t('foodSearch.ingredientContext', { recipe: ingredientFor.recipeName })
              : t('foodSearch.ingredientContextNew')
            : t('foodSearch.context', { meal: meal!.name, date: dateLabel })}
        </AppText>
        {ingredientMode ? null : (
          <>
            <PressableIcon
              icon={selecting ? 'checkmark-done-circle' : 'checkmark-done-outline'}
              accessibilityLabel={t('foodSearch.select.toggle')}
              onPress={() => (selecting ? leaveSelectMode() : setSelecting(true))}
              selected={selecting}
              color={selecting ? 'primary' : 'textSecondary'}
              testID="food-search-select"
            />
            <PressableIcon
              icon="flash-outline"
              accessibilityLabel={t('foodSearch.quickCalories')}
              onPress={onQuickCalories}
              disabled={selecting}
              color="textSecondary"
              testID="food-search-quick-calories"
            />
          </>
        )}
      </View>
      <View style={{ paddingTop: theme.spacing[2] }}>
        <TabStrip
          tabs={[
            { id: 'all', label: t('foodSearch.tabs.all') },
            { id: 'recent', label: t('foodSearch.tabs.recent') },
            { id: 'custom', label: t('foodSearch.tabs.custom') },
            ...(ingredientMode ? [] : [{ id: 'recipes' as const, label: t('foodSearch.tabs.recipes') }]),
          ]}
          selected={tab}
          onSelect={chooseTab}
          accessibilityLabel={t('foodSearch.tabs.label')}
          testID="food-search-tab"
        />
      </View>
      {deleteFailed ? (
        <View style={{ paddingHorizontal: theme.spacing[4], paddingTop: theme.spacing[3] }}>
          <InlineStatus tone="error" message={t('foodSearch.deleteError')} />
        </View>
      ) : null}
      {tab === 'all' ? null : <View style={{ height: theme.spacing[2] }} />}
    </>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.canvas }}>
      <AppBar
        title={t('foodSearch.title')}
        back={{ label: t('common.back'), onPress: leaveSearch }}
        bottom={
          <View style={{ paddingHorizontal: theme.spacing[3], paddingBottom: theme.spacing[2] }}>
            <View
              style={{
                minHeight: 48,
                flexDirection: 'row',
                alignItems: 'center',
                borderRadius: theme.radii.medium,
                backgroundColor: theme.colors.surface,
                paddingLeft: theme.spacing[3],
              }}
            >
              <AppText accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                🔍
              </AppText>
              <TextInput
                autoFocus={autoFocus}
                value={query}
                onChangeText={updateQuery}
                placeholder={t('foodSearch.placeholder')}
                placeholderTextColor={theme.colors.textSecondary}
                accessibilityLabel={t('foodSearch.searchLabel')}
                testID="food-search-input"
                returnKeyType="search"
                autoCapitalize="none"
                style={{
                  flex: 1,
                  minHeight: 48,
                  paddingHorizontal: theme.spacing[2],
                  color: theme.colors.textPrimary,
                  fontSize: theme.typography.body.fontSize,
                }}
              />
              {query ? (
                <PressableIcon
                  icon="close"
                  accessibilityLabel={t('foodSearch.clear')}
                  onPress={() => updateQuery('')}
                  color="textSecondary"
                  testID="food-search-clear"
                />
              ) : null}
              {
                /* POST-15: the scan icon returns in ingredient mode when the stack's scanner writes into the draft. */
                !ingredientMode || ingredientScan ? (
                  <PressableIcon
                    icon="barcode-outline"
                    accessibilityLabel={t('foodSearch.scanBarcode')}
                    onPress={onScan}
                    disabled={selecting}
                    color="textSecondary"
                    testID="food-search-scan"
                  />
                ) : null
              }
            </View>
          </View>
        }
      />
      <SectionList
        testID="food-search-list"
        sections={listSections}
        keyExtractor={(row) => row.key}
        renderItem={renderRow}
        renderSectionHeader={({ section }) =>
          section.header ? (
            // Opaque, so rows scrolling under the sticky label don't show through it.
            <View style={{ backgroundColor: theme.colors.canvas }}>
              <SectionHeader label={section.header} uppercase />
            </View>
          ) : null
        }
        stickySectionHeadersEnabled // UX-04 sticky section labels (RN's default is iOS-only)
        ListHeaderComponent={listHeader}
        extraData={selection}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: theme.spacing[6] }}
      />
      {selecting ? (
        <View
          style={{
            gap: theme.spacing[2],
            paddingHorizontal: theme.spacing[4],
            paddingVertical: theme.spacing[3],
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: theme.colors.divider,
            backgroundColor: theme.colors.surface,
          }}
        >
          {addFailed ? <InlineStatus tone="error" message={t('foodSearch.select.addError')} /> : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[3] }}>
            <AppText style={{ flex: 1 }} testID="food-search-selected-count">
              {t('foodSearch.select.count', { count: selection.length })}
            </AppText>
            <PrimaryButton
              label={t('foodSearch.select.add', { meal: meal?.name ?? '' })}
              onPress={() => void addSelection()}
              disabled={selection.length === 0}
              loading={diaryWrites.addFoodEntries.isPending}
              testID="food-search-add-selected"
            />
          </View>
        </View>
      ) : null}
      {deletedFood ? (
        <UndoToast
          key={deletedFood.id}
          message={t('foodSearch.deleted', { name: deletedFood.name })}
          undoLabel={t('common.undo')}
          onUndo={() => void undoDelete()}
          onDismiss={() => setDeletedFood(null)}
          testID="food-delete-undo"
        />
      ) : null}
      {added && !deletedFood ? (
        <UndoToast
          key={added.key}
          message={t('foodSearch.added', { name: added.foodName, meal: added.mealName })}
          onDismiss={() => clearAddedFood(added.key)}
          testID="food-added-toast"
        />
      ) : null}
    </View>
  );
}

/** UX-04 / PROV-12: one provider section's inline error status (`<Provider>` texts). */
function ProviderError({
  provider,
  error,
  onRetry,
  onFoodDatabases,
}: {
  provider: 'usda' | 'open_food_facts';
  error: unknown;
  onRetry: () => void;
  onFoodDatabases?: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const isUsda = provider === 'usda';
  if (isUsda && error instanceof ProviderConfigurationError) {
    const missing = error.code === 'usda_key_missing'; // ARCH-13: branch on the typed code, never message text
    return (
      <View style={{ paddingHorizontal: theme.spacing[4], gap: theme.spacing[2] }}>
        <InlineStatus tone="error" message={t(missing ? 'foodSearch.usdaKeyMissing' : 'foodSearch.usdaKeyRejected')} />
        {onFoodDatabases ? (
          <TextAction icon="settings-outline" label={t('foodSearch.foodDatabases')} onPress={onFoodDatabases} />
        ) : null}
      </View>
    );
  }
  if (error instanceof RateLimitError)
    return <InlineStatus tone="info" message={t(isUsda ? 'foodSearch.usdaBusy' : 'foodSearch.offBusy')} />;
  return (
    <View style={{ paddingHorizontal: theme.spacing[4], gap: theme.spacing[2] }}>
      <InlineStatus tone="error" message={t(isUsda ? 'foodSearch.usdaFailed' : 'foodSearch.offFailed')} />
      <TextAction icon="refresh" label={t('foodSearch.retry')} onPress={onRetry} />
    </View>
  );
}
