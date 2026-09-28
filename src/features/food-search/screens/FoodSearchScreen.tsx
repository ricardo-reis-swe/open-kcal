import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PanResponder, ScrollView, TextInput, View } from 'react-native';

import type { Food } from '@/data/db/repositories/foodsRepository';
import { useServices } from '@/bootstrap/services';
import { nowUtcIso } from '@/shared/dates';
import { PARSER_VERSION } from '@/data/api/open-food-facts/mapper';
import { PARSER_VERSION as USDA_PARSER_VERSION } from '@/data/api/usda/mapper';
import { ProviderConfigurationError, RateLimitError } from '@/shared/errors';
import { useAppSettings, useMeals } from '@/features/diary/diary.queries';
import { AppBar, AppText, InlineStatus, PressableIcon, SectionHeader, TextAction } from '@/shared/components';
import type { LocalDate } from '@/shared/dates';
import { formatEnergy, formatShortDate, relativeDay } from '@/shared/i18n/format';
import { useFormattingLocale } from '@/shared/i18n/useFormattingLocale';
import { FocusablePressable } from '@/shared/components/FocusablePressable';
import { useTheme } from '@/shared/theme';

import {
  useCustomFoodSearch,
  useLocalFoodWrites,
  useOpenFoodFactsSearch,
  useOnlineStatus,
  useRecentFoods,
  refreshSavedOpenFoodFacts,
  useSavedFoodSearch,
  useUsdaSearch,
} from '../food-search.queries';
import { onlineItemKey, type OnlineItem, type OnlineProvider } from '../online-results';
import { useOnlineResults } from '../useOnlineResults';

const LOCAL_DEBOUNCE_MS = 150;
const OFF_DEBOUNCE_MS = 800;
const USDA_DEBOUNCE_MS = 400;
const DELETE_REVEAL_WIDTH = 88;

export const shouldRevealFoodDelete = (dx: number) => dx <= -40;

type Props = {
  mealId: string;
  date: LocalDate;
  today: LocalDate;
  initialQuery?: string;
  onBack: () => void;
  onQuickCalories: () => void;
  onCreateCustom: (initialName: string) => void;
  onFoodDatabases?: () => void;
  onSelectFood: (food: Food) => void;
};

/** UX-04: focused search, Recents without a query, local sections after 150 ms and one merged `Online` list (PROV-08). */
export function FoodSearchScreen({
  mealId,
  date,
  today,
  initialQuery = '',
  onBack,
  onQuickCalories,
  onCreateCustom,
  onSelectFood,
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
  const [externalLoadError, setExternalLoadError] = useState<string | null>(null);
  const [selectingExternalId, setSelectingExternalId] = useState<string | null>(null);
  const offDetailController = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery.trim());
  const [offQuery, setOffQuery] = useState(initialQuery.trim());
  const [usdaQuery, setUsdaQuery] = useState(initialQuery.trim());
  const [offPages, setOffPages] = useState(1);
  const [customPages, setCustomPages] = useState(1);
  const [savedPages, setSavedPages] = useState(1);
  const [usdaPages, setUsdaPages] = useState(1);
  useEffect(
    () => () => {
      mounted.current = false;
      offDetailController.current?.abort();
    },
    [],
  );
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
  const custom = useCustomFoodSearch(debouncedQuery, customPages);
  const saved = useSavedFoodSearch(debouncedQuery, savedPages);
  const off = useOpenFoodFactsSearch(offQuery, offPages, i18n.resolvedLanguage ?? i18n.language);
  const usda = useUsdaSearch(usdaQuery, usdaPages);
  const online = useOnlineStatus();
  const remote = useOnlineResults(query, [usda, off], online);
  const meal = meals.data?.find((candidate) => candidate.id === mealId);
  if (!meal || !settings.data) return null;
  const relative = relativeDay(date, today);
  const dateLabel = relative ? t(`diary.${relative}`) : formatShortDate(date, today, locale);
  const hasQuery = query.trim().length > 0;
  const searching = hasQuery && query.trim() !== debouncedQuery;
  const customFoods = custom.data ?? [];
  const savedFoods = saved.data ?? [];
  // PROV-08 / DATA-15: a remote hit already in Saved shows as its local copy instead.
  const savedKeys = new Set(
    savedFoods
      .filter((food) => food.source !== 'custom' && food.externalId)
      .map((food) => onlineItemKey({ provider: food.source as OnlineProvider, externalId: food.externalId! })),
  );
  const onlineFoods = remote.items.filter((item) => !savedKeys.has(onlineItemKey(item)));
  const remoteSearched = query.trim().length >= 2;
  const showMoreOnline = () => {
    if (usda.hasMore) setUsdaPages((current) => current + 1);
    if (off.hasMore) setOffPages((current) => current + 1);
  };
  const updateQuery = (value: string) => {
    if (value.trim() !== offQuery) {
      setOffPages(1);
      setCustomPages(1);
      setSavedPages(1);
      setUsdaPages(1);
    }
    setQuery(value);
  };
  const selectUsda = async (externalId: string) => {
    setExternalLoadError(null);
    setSelectingExternalId(externalId);
    const controller = new AbortController();
    offDetailController.current?.abort();
    offDetailController.current = controller;
    try {
      const detail = await services.usda.getFood(externalId, controller.signal);
      if (!detail || controller.signal.aborted || !mounted.current) throw new Error('USDA detail unavailable');
      const fetchedAt = nowUtcIso(services.clock);
      const expiresAt = new Date(
        services.clock.now().getTime() + 90 * 24 * 60 * 60_000,
      ).toISOString() as typeof fetchedAt;
      const saved = await services.foods.upsertExternal('usda', detail.externalId, detail.input, {
        fetchedAt,
        expiresAt,
        rawPayloadJson: null,
        schemaVersion: USDA_PARSER_VERSION,
      });
      if (!controller.signal.aborted && mounted.current) onSelectFood(saved);
    } catch {
      if (!controller.signal.aborted && mounted.current) setExternalLoadError(externalId);
    } finally {
      if (mounted.current) setSelectingExternalId(null);
    }
  };
  const leaveSearch = () => {
    offDetailController.current?.abort();
    onBack();
  };
  const deleteFood = async (foodId: string) => {
    setDeleteFailed(false);
    try {
      await writes.deleteCustom.mutateAsync(foodId);
    } catch {
      setDeleteFailed(true);
    }
  };
  const selectOff = async (externalId: string) => {
    setExternalLoadError(null);
    setSelectingExternalId(externalId);
    offDetailController.current?.abort();
    const controller = new AbortController();
    offDetailController.current = controller;
    try {
      const detail = await services.openFoodFacts.getFood(externalId, controller.signal);
      if (controller.signal.aborted || !mounted.current) return;
      if (!detail) throw new Error('Open Food Facts returned insufficient data');
      const fetchedAt = nowUtcIso(services.clock);
      const expiresAt = new Date(
        services.clock.now().getTime() + 30 * 24 * 60 * 60_000,
      ).toISOString() as typeof fetchedAt;
      const saved = await services.foods.upsertExternal('open_food_facts', detail.externalId, detail.input, {
        fetchedAt,
        expiresAt,
        rawPayloadJson: null,
        schemaVersion: PARSER_VERSION,
      });
      if (controller.signal.aborted || !mounted.current) return;
      onSelectFood(saved);
    } catch {
      if (!controller.signal.aborted && mounted.current) setExternalLoadError(externalId);
    } finally {
      if (offDetailController.current === controller) offDetailController.current = null;
      if (mounted.current) setSelectingExternalId(null);
    }
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
                autoFocus
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
                {customFoods.length > 0 ? <SectionHeader label={t('foodSearch.myFoods')} uppercase /> : null}
                {customFoods.map((food) => (
                  <FoodResultRow
                    key={food.id}
                    food={food}
                    locale={locale}
                    energyUnit={settings.data.energyUnit}
                    onPress={() => onSelectFood(food)}
                    onDelete={food.source === 'custom' ? () => void deleteFood(food.id) : undefined}
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
                {savedFoods.length > 0 ? <SectionHeader label={t('foodSearch.saved')} uppercase /> : null}
                {savedFoods.map((food) => (
                  <FoodResultRow
                    key={food.id}
                    food={food}
                    locale={locale}
                    energyUnit={settings.data.energyUnit}
                    onPress={() => {
                      void refreshSavedOpenFoodFacts(services, food);
                      onSelectFood(food);
                    }}
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
                {remoteSearched ? <SectionHeader label={t('foodSearch.online')} uppercase /> : null}
                {onlineFoods.map((item) => (
                  <OnlineResultRow
                    key={onlineItemKey(item)}
                    item={item}
                    locale={locale}
                    energyUnit={settings.data.energyUnit}
                    onPress={() =>
                      void (item.provider === 'usda' ? selectUsda(item.externalId) : selectOff(item.externalId))
                    }
                    disabled={selectingExternalId !== null}
                    loading={selectingExternalId === item.externalId}
                    error={externalLoadError === item.externalId ? t('foodSearch.offLoadFailed') : undefined}
                  />
                ))}
                {online && remote.hasMore && remote.settled ? (
                  <TextAction
                    icon="add"
                    label={t('foodSearch.showMore')}
                    onPress={showMoreOnline}
                    testID="food-search-online-show-more"
                  />
                ) : null}
                {remoteSearched ? (
                  <OnlineStatusRow
                    online={online}
                    loading={remote.loading}
                    errors={remote.errors}
                    empty={
                      remote.settled && onlineFoods.length === 0 && (customFoods.length > 0 || savedFoods.length > 0)
                    }
                    onFoodDatabases={onFoodDatabases}
                  />
                ) : null}
                {customFoods.length === 0 && savedFoods.length === 0 && onlineFoods.length === 0 && !remote.loading ? (
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
                  onPress={() => onSelectFood(food)}
                  onDelete={food.source === 'custom' ? () => void deleteFood(food.id) : undefined}
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
    </View>
  );
}

type FoodRowProps = {
  food: Food;
  locale: string;
  energyUnit: 'kcal' | 'kJ';
  onPress: () => void;
  onDelete?: () => void;
  disabled?: boolean;
  loading?: boolean;
  error?: string;
};

function FoodResultRow({
  food,
  locale,
  energyUnit,
  onPress,
  onDelete,
  disabled = false,
  loading = false,
  error,
}: FoodRowProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const basis = food.brand || t('foodSearch.perBasis', { quantity: food.basisQuantity, unit: food.basisUnit });
  const energy = t('foodSearch.energy', {
    value: formatEnergy(food.nutrients.energyKcal, energyUnit, locale),
    unit: t(`diary.units.${energyUnit}`),
  });
  const energyValue = formatEnergy(food.nutrients.energyKcal, energyUnit, locale);
  const energyUnitLabel = t(`diary.units.${energyUnit}`);
  const [revealed, setRevealed] = useState(false);
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) => Boolean(onDelete) && gesture.dx < -10,
        onPanResponderRelease: (_event, gesture) => setRevealed(shouldRevealFoodDelete(gesture.dx)),
        onPanResponderTerminate: () => setRevealed(false),
      }),
    [onDelete],
  );
  return (
    <View style={{ overflow: 'hidden', backgroundColor: theme.colors.danger }}>
      <View
        {...pan.panHandlers}
        testID={`food-swipe-${food.id}`}
        pointerEvents={revealed ? 'none' : 'auto'}
        style={{ transform: [{ translateX: revealed ? -DELETE_REVEAL_WIDTH : 0 }] }}
      >
        <FocusablePressable
          accessibilityRole="button"
          accessibilityLabel={`${food.name}, ${basis}, ${energy}`}
          accessibilityActions={onDelete ? [{ name: 'delete', label: t('foodSearch.deleteFood') }] : undefined}
          onAccessibilityAction={(event) => {
            if (event.nativeEvent.actionName === 'delete') onDelete?.();
          }}
          disabled={disabled}
          onPress={() => {
            if (revealed) setRevealed(false);
            else onPress();
          }}
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
            <AppText numberOfLines={1}>{loading ? t('foodSearch.loadingFood') : food.name}</AppText>
            <AppText variant="compact" color="textSecondary" numberOfLines={1}>
              {basis} · {t(`foodSearch.sources.${food.source}`)}
            </AppText>
            {error ? <InlineStatus tone="error" message={error} /> : null}
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
      </View>
      {onDelete ? (
        <FocusablePressable
          accessibilityRole="button"
          accessibilityLabel={t('foodSearch.delete')}
          accessible={revealed}
          accessibilityElementsHidden={!revealed}
          importantForAccessibility={revealed ? 'auto' : 'no-hide-descendants'}
          onPress={onDelete}
          testID={`food-delete-${food.id}`}
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            width: DELETE_REVEAL_WIDTH,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <AppText variant="compactStrong" color="onPrimary">
            {t('foodSearch.delete')}
          </AppText>
        </FocusablePressable>
      ) : null}
    </View>
  );
}

function OnlineResultRow({ item, ...props }: { item: OnlineItem } & Omit<FoodRowProps, 'food'>) {
  return (
    <FoodResultRow
      {...props}
      food={{
        ...item.input,
        brand: item.input.brand ?? null,
        id: `${item.provider === 'usda' ? 'usda' : 'off'}-${item.externalId}`,
        source: item.provider,
        externalId: item.externalId,
        isDeleted: false,
        servings: [],
      }}
    />
  );
}

/** UX-04: one compact status row under `Online`, merging both providers' states (nothing when all is fine). */
function OnlineStatusRow({
  online,
  loading,
  errors,
  empty,
  onFoodDatabases,
}: {
  online: boolean;
  loading: boolean;
  errors: { provider: OnlineProvider; error: unknown; retry: () => void }[];
  empty: boolean;
  onFoodDatabases?: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const lines = !online
    ? [<InlineStatus key="offline" tone="offline" message={t('foodSearch.offline')} />]
    : [
        ...(loading ? [<InlineStatus key="loading" tone="loading" message={t('foodSearch.searching')} />] : []),
        ...errors.map(({ provider, error, retry }) => (
          <ProviderError
            key={provider}
            provider={provider}
            error={error}
            onRetry={retry}
            onFoodDatabases={onFoodDatabases}
          />
        )),
        ...(empty && !loading && errors.length === 0
          ? [<InlineStatus key="empty" tone="info" message={t('foodSearch.onlineNoResults')} />]
          : []),
      ];
  if (lines.length === 0) return null;
  return (
    <View
      testID="food-search-online-status"
      style={{ paddingHorizontal: theme.spacing[4], paddingTop: theme.spacing[2], gap: theme.spacing[2] }}
    >
      {lines}
    </View>
  );
}

function ProviderError({
  provider,
  error,
  onRetry,
  onFoodDatabases,
}: {
  provider: OnlineProvider;
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
      <View style={{ gap: theme.spacing[2] }}>
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
    <View style={{ gap: theme.spacing[2] }}>
      <InlineStatus tone="error" message={t(isUsda ? 'foodSearch.usdaFailed' : 'foodSearch.offFailed')} />
      <TextAction
        icon="refresh"
        label={t('foodSearch.retryProvider', { provider: t(isUsda ? 'foodSearch.usda' : 'foodSearch.openFoodFacts') })}
        onPress={onRetry}
      />
    </View>
  );
}
