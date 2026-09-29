import { Fragment, useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, TextInput, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

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
  AppIcon,
  AppText,
  InlineStatus,
  PressableIcon,
  SectionHeader,
  TextAction,
  UndoToast,
} from '@/shared/components';
import type { LocalDate } from '@/shared/dates';
import { formatEnergy, formatShortDate, relativeDay } from '@/shared/i18n/format';
import { useFormattingLocale } from '@/shared/i18n/useFormattingLocale';
import { FocusablePressable } from '@/shared/components/FocusablePressable';
import { useTheme } from '@/shared/theme';

import {
  useCustomFoodSearch,
  useFoodSearchSections,
  useLocalFoodWrites,
  useOpenFoodFactsSearch,
  useOnlineStatus,
  useRecentFoods,
  refreshSavedOpenFoodFacts,
  useSavedFoodSearch,
  useUsdaSearch,
} from '../food-search.queries';

const LOCAL_DEBOUNCE_MS = 150;
const OFF_DEBOUNCE_MS = 800;
const USDA_DEBOUNCE_MS = 400;
const DELETE_SWIPE_LIMIT = 120;
const DELETE_EXIT_OFFSET = 500;

export const shouldCommitFoodDelete = (dx: number) => dx <= -72;

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
  onSelectExternal: (source: 'usda' | 'open_food_facts', externalId: string) => void;
};

/** UX-04 M4 subset: focused search, Recents without a query, and local custom-food results after 150 ms. */
export function FoodSearchScreen({
  mealId,
  date,
  today,
  initialQuery = '',
  onBack,
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
      await writes.deleteCustom.mutateAsync(food.id);
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
      await writes.restoreCustom.mutateAsync(deletedFood.id);
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
                  onPress={() => onSelectFood(food)}
                  onDelete={food.source === 'custom' ? () => deleteFood(food) : undefined}
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
  /** Resolving `false` (the delete failed) springs the row back into place. */
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
  const translateX = useSharedValue(0);
  const commitDelete = () =>
    void onDelete?.().then((deleted) => {
      if (!deleted) translateX.set(withTiming(0, { duration: 160 }));
    });
  const pan = Gesture.Pan()
    .withTestId(`food-swipe-${food.id}-pan`)
    .enabled(Boolean(onDelete))
    .activeOffsetX([-10, 10])
    .failOffsetY([-10, 10])
    .onUpdate((event) => translateX.set(Math.max(-DELETE_SWIPE_LIMIT, Math.min(0, event.translationX))))
    .onFinalize((event) => {
      const committed = event.velocityX < -700 || shouldCommitFoodDelete(translateX.get());
      if (!committed) {
        translateX.set(withTiming(0, { duration: 160 }));
        return;
      }
      translateX.set(
        withTiming(-DELETE_EXIT_OFFSET, { duration: 180 }, (finished) => {
          if (finished) scheduleOnRN(commitDelete);
        }),
      );
    });
  const animatedRow = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.get() }] }));
  return (
    <View style={{ overflow: 'hidden', backgroundColor: theme.colors.danger }}>
      {onDelete ? (
        <View
          pointerEvents="none"
          testID={`food-delete-icon-${food.id}`}
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            width: 88,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <AppIcon name="trash-outline" color="onPrimary" />
        </View>
      ) : null}
      <GestureDetector gesture={pan}>
        <Animated.View testID={`food-swipe-${food.id}`} style={animatedRow}>
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
        </Animated.View>
      </GestureDetector>
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
