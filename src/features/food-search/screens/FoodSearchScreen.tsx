import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';

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
  refreshSavedFood,
  useSavedFoodSearch,
  useUsdaSearch,
} from '../food-search.queries';

const LOCAL_DEBOUNCE_MS = 150;
const OFF_DEBOUNCE_MS = 800;
const USDA_DEBOUNCE_MS = 800;

/** UX-04 tabs. `all` is the sectioned search; the others are local lists that never call a provider. */
type SearchTab = 'all' | 'recent' | 'custom';

/** UX-04 select mode: Back (system back, swipe-back) while it's on leaves select mode instead of the screen. */
export type SelectBackGuard = (enabled: boolean, onAttempt: () => void) => void;
const noBackGuard: SelectBackGuard = () => {};

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
}: Props) {
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
  const visibleSections = sections.data ? visibleFoodSearchSections(sections.data) : [];
  // UX-04: only `All` follows UX-18 visibility and searches providers; `My foods` always lists custom foods.
  const shows = (id: FoodSearchSectionId) => tab === 'all' && visibleSections.includes(id);
  const custom = useCustomFoodSearch(debouncedQuery, customPages, shows('custom') || tab === 'custom');
  const customList = useCustomFoodList(customPages, tab === 'custom' && debouncedQuery.length === 0);
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
  if (!meal || !settings.data || !sections.data) return null;
  const relative = relativeDay(date, today);
  const dateLabel = relative ? t(`diary.${relative}`) : formatShortDate(date, today, locale);
  const hasQuery = query.trim().length > 0;
  const searching = hasQuery && query.trim() !== debouncedQuery;
  const customFoods = shows('custom') ? (custom.data ?? []) : [];
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
      setSavedPages(1);
      setUsdaPages(1);
    }
    setQuery(value);
  };
  const chooseTab = (next: SearchTab) => {
    setCustomPages(1);
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
      : { onPress: open, onDelete };
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
  const sectionContent: Record<FoodSearchSectionId, ReactNode> = {
    custom: (
      <>
        {customFoods.length > 0 ? <SectionHeader label={t('foodSearch.myFoods')} uppercase /> : null}
        {customFoods.map((food) => (
          <FoodResultRow
            key={food.id}
            food={food}
            locale={locale}
            energyUnit={settings.data.energyUnit}
            {...storedRowProps(
              food,
              () => onSelectFood(food),
              food.source === 'custom' ? () => deleteFood(food) : undefined,
            )}
          />
        ))}
        {customFoods.length === customPages * 20 ? (
          <TextAction
            icon="add"
            label={t('foodSearch.showMore')}
            onPress={() => setCustomPages((current) => current + 1)}
            testID="food-search-custom-show-more"
          />
        ) : null}
      </>
    ),
    saved: (
      <>
        {savedFoods.length > 0 ? <SectionHeader label={t('foodSearch.saved')} uppercase /> : null}
        {savedFoods.map((food) => (
          <FoodResultRow
            key={food.id}
            food={food}
            locale={locale}
            energyUnit={settings.data.energyUnit}
            {...storedRowProps(
              food,
              () => {
                void refreshSavedFood(services, food);
                onSelectFood(food);
              },
              () => deleteFood(food),
            )}
          />
        ))}
        {savedFoods.length === savedPages * 20 ? (
          <TextAction
            icon="add"
            label={t('foodSearch.showMore')}
            onPress={() => setSavedPages((current) => current + 1)}
            testID="food-search-saved-show-more"
          />
        ) : null}
      </>
    ),
    open_food_facts: (
      <>
        {query.trim().length >= 3 ? <SectionHeader label={t('foodSearch.openFoodFacts')} uppercase /> : null}
        {query.trim().length >= 3 && query.trim() !== offQuery ? (
          <AppText color="textSecondary" style={{ paddingHorizontal: theme.spacing[4] }}>
            {t('foodSearch.searching')}
          </AppText>
        ) : null}
        {online && off.isLoading && query.trim() === offQuery ? (
          <AppText color="textSecondary" style={{ paddingHorizontal: theme.spacing[4] }}>
            {t('foodSearch.searching')}
          </AppText>
        ) : null}
        {off.isError ? (
          <ProviderError provider="open_food_facts" error={off.error} onRetry={() => void off.refetch()} />
        ) : null}
        {offFoods.map((candidate) => (
          <FoodResultRow
            key={`off-${candidate.externalId}`}
            food={{
              ...candidate.input,
              brand: candidate.input.brand ?? null,
              barcode: candidate.input.barcode ?? null,
              id: `off-${candidate.externalId}`,
              source: 'open_food_facts',
              externalId: candidate.externalId,
              isDeleted: false,
              servings: [],
            }}
            locale={locale}
            energyUnit={settings.data.energyUnit}
            dimmed={selecting}
            onPress={() => onSelectExternal('open_food_facts', candidate.externalId)}
          />
        ))}
        {off.hasMore && query.trim() === offQuery ? (
          <TextAction
            icon="add"
            label={t('foodSearch.showMore')}
            onPress={() => setOffPages((current) => current + 1)}
            testID="food-search-off-show-more"
          />
        ) : null}
        {off.isSuccess && query.trim() === offQuery && offFoods.length === 0 ? (
          <AppText color="textSecondary" style={{ paddingHorizontal: theme.spacing[4] }}>
            {t('foodSearch.providerNoResults', { provider: t('foodSearch.openFoodFacts') })}
          </AppText>
        ) : null}
      </>
    ),
    usda: (
      <>
        {query.trim().length >= 2 ? <SectionHeader label={t('foodSearch.usda')} uppercase /> : null}
        {query.trim().length >= 2 && usdaQuery !== query.trim() ? (
          <AppText color="textSecondary" style={{ paddingHorizontal: theme.spacing[4] }}>
            {t('foodSearch.searching')}
          </AppText>
        ) : null}
        {online && usda.isLoading ? (
          <AppText color="textSecondary" style={{ paddingHorizontal: theme.spacing[4] }}>
            {t('foodSearch.searching')}
          </AppText>
        ) : null}
        {usda.isError ? (
          <ProviderError
            provider="usda"
            error={usda.error}
            onRetry={() => void usda.refetch()}
            onFoodDatabases={onFoodDatabases}
          />
        ) : null}
        {usdaFoods.map((candidate) => (
          <FoodResultRow
            key={`usda-${candidate.externalId}`}
            food={{
              ...candidate.input,
              brand: candidate.input.brand ?? null,
              barcode: candidate.input.barcode ?? null,
              id: `usda-${candidate.externalId}`,
              source: 'usda',
              externalId: candidate.externalId,
              isDeleted: false,
              servings: [],
            }}
            locale={locale}
            energyUnit={settings.data.energyUnit}
            dimmed={selecting}
            onPress={() => onSelectExternal('usda', candidate.externalId)}
          />
        ))}
        {usda.hasMore && usdaQuery === query.trim() ? (
          <TextAction
            icon="add"
            label={t('foodSearch.showMore')}
            onPress={() => setUsdaPages((current) => current + 1)}
            testID="food-search-usda-show-more"
          />
        ) : null}
        {usda.isSuccess && usdaQuery === query.trim() && usdaFoods.length === 0 ? (
          <AppText color="textSecondary" style={{ paddingHorizontal: theme.spacing[4] }}>
            {t('foodSearch.providerNoResults', { provider: t('foodSearch.usda') })}
          </AppText>
        ) : null}
      </>
    ),
  };

  const recentRow = (food: Food) => (
    <FoodResultRow
      key={food.id}
      food={food}
      locale={locale}
      energyUnit={settings.data.energyUnit}
      {...storedRowProps(
        food,
        () => {
          void refreshSavedFood(services, food); // PROV-09: Recent opens refresh too
          onSelectFood(food);
        },
        () => deleteFood(food),
      )}
    />
  );
  const padded = { paddingHorizontal: theme.spacing[4] };
  const searchingRow = (
    <AppText color="textSecondary" style={padded}>
      {t('foodSearch.searching')}
    </AppText>
  );
  const noResults = <AppText style={padded}>{t('foodSearch.noResults', { query: query.trim() })}</AppText>;
  const recentFoods = (recents.data ?? []).map(({ food }) => food);
  // UX-04 Recent tab: the ≤20 Recents (DATA-14), filtered in memory with the PROV-08 token rule.
  const recentTab = searching ? (
    searchingRow
  ) : recentFoods.length === 0 ? (
    <AppText color="textSecondary" style={padded}>
      {t('foodSearch.emptyRecentTab')}
    </AppText>
  ) : hasQuery && !recentFoods.some((food) => matchesFoodQuery(food, debouncedQuery)) ? (
    noResults
  ) : (
    recentFoods.filter((food) => matchesFoodQuery(food, debouncedQuery)).map(recentRow)
  );
  // UX-04 My foods tab: every custom food (DATA-25) without a query; the PROV-08 custom search with one.
  const myFoods = (hasQuery ? custom.data : customList.data) ?? [];
  const myFoodsLoaded = hasQuery ? custom.isSuccess : customList.isSuccess;
  // UX-04: `Create custom food` lives on this tab only, always first (initialName = current query).
  const createCustom = (
    <View style={padded}>
      <TextAction
        icon="add"
        label={t('foodSearch.createCustom')}
        onPress={() => onCreateCustom(query.trim())}
        testID="food-create-custom"
      />
    </View>
  );
  const customRows = searching ? (
    searchingRow
  ) : !myFoodsLoaded ? null : myFoods.length === 0 ? (
    hasQuery ? (
      noResults
    ) : (
      <AppText color="textSecondary" style={padded}>
        {t('foodSearch.emptyCustom')}
      </AppText>
    )
  ) : (
    <>
      {myFoods.map((food) => (
        <FoodResultRow
          key={food.id}
          food={food}
          locale={locale}
          energyUnit={settings.data.energyUnit}
          {...storedRowProps(
            food,
            () => onSelectFood(food),
            () => deleteFood(food),
          )}
        />
      ))}
      {myFoods.length === customPages * 20 ? (
        <TextAction
          icon="add"
          label={t('foodSearch.showMore')}
          onPress={() => setCustomPages((current) => current + 1)}
          testID="food-search-custom-show-more"
        />
      ) : null}
    </>
  );
  const customTab = (
    <>
      {selecting ? null : createCustom}
      {customRows}
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
              <PressableIcon
                icon="barcode-outline"
                accessibilityLabel={t('foodSearch.scanBarcode')}
                onPress={onScan}
                disabled={selecting}
                color="textSecondary"
                testID="food-search-scan"
              />
            </View>
          </View>
        }
      />
      <ScrollView
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: theme.spacing[6] }}
      >
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
          <AppText variant="compact" color="textSecondary" style={{ flex: 1 }}>
            {t('foodSearch.context', { meal: meal.name, date: dateLabel })}
          </AppText>
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
        </View>
        <View style={{ paddingTop: theme.spacing[2] }}>
          <TabStrip
            tabs={[
              { id: 'all', label: t('foodSearch.tabs.all') },
              { id: 'recent', label: t('foodSearch.tabs.recent') },
              { id: 'custom', label: t('foodSearch.tabs.custom') },
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
        {tab === 'recent' ? (
          <View style={{ paddingTop: theme.spacing[2] }}>{recentTab}</View>
        ) : tab === 'custom' ? (
          <View style={{ paddingTop: theme.spacing[2] }}>{customTab}</View>
        ) : hasQuery ? (
          <>
            {searching ? (
              <AppText color="textSecondary" style={{ paddingHorizontal: theme.spacing[4] }}>
                {t('foodSearch.searching')}
              </AppText>
            ) : (
              <>
                {visibleSections.map((id) => (
                  <Fragment key={id}>
                    {id === firstVisibleRemote && !online ? (
                      <InlineStatus tone="info" message={t('foodSearch.offline')} />
                    ) : null}
                    {sectionContent[id]}
                  </Fragment>
                ))}
                {customFoods.length === 0 &&
                savedFoods.length === 0 &&
                offFoods.length === 0 &&
                usdaFoods.length === 0 &&
                !remoteLoading
                  ? noResults
                  : null}
              </>
            )}
          </>
        ) : (
          <>
            <SectionHeader label={t('foodSearch.recent')} uppercase />
            {recentFoods.length > 0 ? (
              recentFoods.map(recentRow)
            ) : (
              <AppText color="textSecondary" style={{ paddingHorizontal: theme.spacing[4] }}>
                {t('foodSearch.emptyRecent')}
              </AppText>
            )}
          </>
        )}
      </ScrollView>
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
              label={t('foodSearch.select.add', { meal: meal.name })}
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
