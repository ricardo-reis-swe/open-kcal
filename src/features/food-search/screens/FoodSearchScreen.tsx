import { Fragment, useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, TextInput, View } from 'react-native';

import type { Food } from '@/data/db/repositories/foodsRepository';
import {
  REMOTE_FOOD_SEARCH_SECTIONS,
  visibleFoodSearchSections,
  type FoodSearchSectionId,
} from '@/domain/food/searchSections';
import { useServices } from '@/bootstrap/services';
import { ProviderConfigurationError, RateLimitError } from '@/shared/errors';
import { useAppSettings, useMeals } from '@/features/diary/diary.queries';
import {
  AppBar,
  AppText,
  InlineStatus,
  PressableIcon,
  SectionHeader,
  SwipeToDelete,
  TextAction,
  UndoToast,
} from '@/shared/components';
import type { LocalDate } from '@/shared/dates';
import { formatEnergy, formatShortDate, relativeDay } from '@/shared/i18n/format';
import { useFormattingLocale } from '@/shared/i18n/useFormattingLocale';
import { FocusablePressable } from '@/shared/components/FocusablePressable';
import { useTheme } from '@/shared/theme';

import { clearAddedFood, useAddedFoodNotice } from '../addedNotice';
import {
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
  const shows = (id: FoodSearchSectionId) => visibleSections.includes(id);
  const custom = useCustomFoodSearch(debouncedQuery, customPages, shows('custom'));
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
  const leaveSearch = () => {
    onBack();
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
            onPress={() => onSelectFood(food)}
            onDelete={food.source === 'custom' ? () => deleteFood(food) : undefined}
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
            onPress={() => {
              void refreshSavedFood(services, food);
              onSelectFood(food);
            }}
            onDelete={() => deleteFood(food)}
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
        <AppText
          variant="compact"
          color="textSecondary"
          style={{ paddingHorizontal: theme.spacing[4], paddingTop: theme.spacing[3] }}
        >
          {t('foodSearch.context', { meal: meal.name, date: dateLabel })}
        </AppText>
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: theme.spacing[3],
            paddingHorizontal: theme.spacing[4],
            paddingTop: theme.spacing[3],
          }}
        >
          <TextAction icon="flash-outline" label={t('foodSearch.quickCalories')} onPress={onQuickCalories} />
          <TextAction
            icon="add"
            label={t('foodSearch.createCustom')}
            onPress={() => onCreateCustom(query.trim())}
            testID="food-search-create-custom"
          />
        </View>
        {deleteFailed ? (
          <View style={{ paddingHorizontal: theme.spacing[4], paddingTop: theme.spacing[3] }}>
            <InlineStatus tone="error" message={t('foodSearch.deleteError')} />
          </View>
        ) : null}
        {hasQuery ? (
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
                !remoteLoading ? (
                  <View style={{ paddingHorizontal: theme.spacing[4], gap: theme.spacing[2] }}>
                    <AppText>{t('foodSearch.noResults', { query: query.trim() })}</AppText>
                    <TextAction
                      icon="add"
                      label={t('foodSearch.createCustom')}
                      onPress={() => onCreateCustom(query.trim())}
                      testID="food-create-custom"
                    />
                  </View>
                ) : null}
              </>
            )}
          </>
        ) : (
          <>
            <SectionHeader label={t('foodSearch.recent')} uppercase />
            {(recents.data ?? []).length > 0 ? (
              recents.data!.map(({ food }) => (
                <FoodResultRow
                  key={food.id}
                  food={food}
                  locale={locale}
                  energyUnit={settings.data.energyUnit}
                  onPress={() => {
                    void refreshSavedFood(services, food); // PROV-09: Recent opens refresh too
                    onSelectFood(food);
                  }}
                  onDelete={() => deleteFood(food)}
                />
              ))
            ) : (
              <AppText color="textSecondary" style={{ paddingHorizontal: theme.spacing[4] }}>
                {t('foodSearch.emptyRecent')}
              </AppText>
            )}
          </>
        )}
      </ScrollView>
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

function FoodResultRow({
  food,
  locale,
  energyUnit,
  onPress,
  onDelete,
  disabled = false,
}: {
  food: Food;
  locale: string;
  energyUnit: 'kcal' | 'kJ';
  onPress: () => void;
  /** Revealed Delete button tap. Resolving `false` (the delete failed) closes the row again. */
  onDelete?: () => Promise<boolean>;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const basis = food.brand || t('foodSearch.perBasis', { quantity: food.basisQuantity, unit: food.basisUnit });
  const energy = t('foodSearch.energy', {
    value: formatEnergy(food.nutrients.energyKcal, energyUnit, locale),
    unit: t(`diary.units.${energyUnit}`),
  });
  const energyValue = formatEnergy(food.nutrients.energyKcal, energyUnit, locale);
  const energyUnitLabel = t(`diary.units.${energyUnit}`);
  return (
    <SwipeToDelete testID={`food-swipe-${food.id}`} label={t('common.delete')} onDelete={onDelete}>
      <FocusablePressable
        accessibilityRole="button"
        accessibilityLabel={`${food.name}, ${basis}, ${energy}`}
        accessibilityActions={onDelete ? [{ name: 'delete', label: t('foodSearch.deleteFood') }] : undefined}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'delete') onDelete?.();
        }}
        disabled={disabled}
        onPress={onPress}
        testID={`food-result-${food.id}`}
        style={({ pressed }) => ({
          minHeight: 60,
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing[3],
          paddingHorizontal: theme.spacing[4],
          paddingVertical: theme.spacing[2],
          backgroundColor: pressed ? theme.colors.primaryTint : theme.colors.surface,
        })}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <AppText numberOfLines={1}>{food.name}</AppText>
          <AppText variant="compact" color="textSecondary" numberOfLines={1}>
            {basis} · {t(`foodSearch.sources.${food.source}`)}
          </AppText>
        </View>
        <View style={{ width: 64, flexShrink: 0, alignItems: 'flex-end', marginLeft: theme.spacing[2] }}>
          <AppText variant="compact" numberOfLines={1} tabular align="right">
            {energyValue}
          </AppText>
          <AppText variant="compact" numberOfLines={1} align="right">
            {energyUnitLabel}
          </AppText>
        </View>
      </FocusablePressable>
    </SwipeToDelete>
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
