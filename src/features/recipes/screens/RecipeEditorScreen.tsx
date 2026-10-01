import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, ScrollView, View } from 'react-native';

import type { Food } from '@/data/db/repositories/foodsRepository';
import type { Recipe, RecipeInput } from '@/data/db/repositories/recipesRepository';
import { CUSTOM_FOOD_AMOUNT_MAX, CUSTOM_FOOD_NAME_MAX, parseLocalizedDecimal } from '@/domain/food/customFood';
import {
  RECIPE_UNITS,
  computeRecipe,
  computedRawServingG,
  ingredientFactor,
  type RecipeServingLabels,
} from '@/domain/food/recipe';
import { isMeasureLabel } from '@/domain/food/servings';
import { scaleNutrients, type Nutrients } from '@/domain/nutrition/nutrients';
import { G_PER_OZ, type EnergyUnit, type FoodWeightUnit } from '@/domain/units/units';
import { useAppSettings } from '@/features/diary/diary.queries';
import { useLocalFoodWrites } from '@/features/food-search/food-search.queries';
import {
  AppBar,
  AppText,
  ConfirmationDialog,
  FormField,
  HeaderAction,
  InlineStatus,
  SectionHeader,
  SwipeToDelete,
  TextAction,
} from '@/shared/components';
import { FocusablePressable } from '@/shared/components/FocusablePressable';
import { formatEnergy, formatGrams } from '@/shared/i18n/format';
import { useFormattingLocale } from '@/shared/i18n/useFormattingLocale';
import { useTheme } from '@/shared/theme';

import {
  createRecipeDraft,
  discardRecipeDraft,
  draftIngredientAmount,
  removeDraftIngredient,
  setDraftRecipeName,
  useRecipeDraft,
  type DraftIngredient,
} from '../recipeDraft';

type Props = {
  /** UX-26 edit mode (from My recipes); create mode without it. */
  recipe?: Recipe;
  initialName?: string;
  onCancel: () => void;
  onSaved: (food: Food) => void;
  /** After the confirmed `Delete recipe` (edit mode only). */
  onDeleted?: () => void;
  /** `+ Add ingredient` → Ingredient Search for this draft. */
  onAddIngredient: (draftId: string) => void;
  /** Ingredient row tap → Ingredient Detail (edit) for this draft. */
  onEditIngredient: (draftId: string, ingredient: DraftIngredient) => void;
};

/** UX-26 Create / Edit Recipe (SCOPE-13, DATA-27/28). Ingredients live in the in-memory draft until Save. */
export function RecipeEditorScreen(props: Props) {
  const theme = useTheme();
  const settings = useAppSettings();
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.canvas }}>
      {settings.data ? (
        <RecipeForm {...props} energyUnit={settings.data.energyUnit} weightUnit={settings.data.foodWeightUnit} />
      ) : null}
    </View>
  );
}

// Hermes on iOS has no `formatToParts`: read the separator from `format(1.1)` (as customFood.ts).
const decimalSeparator = (locale: string) => new Intl.NumberFormat(locale).format(1.1).replace(/\d/g, '') || '.';
const formDecimal = (value: number, locale: string) =>
  String(Math.round(value * 100) / 100).replace('.', decimalSeparator(locale));

function ingredientsFromRecipe(recipe: Recipe | undefined): DraftIngredient[] {
  return (recipe?.ingredients ?? []).map((ingredient) => ({
    key: ingredient.id,
    food: ingredient.food,
    servingId: ingredient.servingId,
    quantity: ingredient.quantity,
    servingUnit: ingredient.servingUnit,
    basisMultiplierSnapshot: ingredient.basisMultiplierSnapshot,
  }));
}

function RecipeForm({
  recipe,
  initialName = '',
  onCancel: cancel,
  onSaved: saved,
  onDeleted: deleted,
  onAddIngredient,
  onEditIngredient,
  energyUnit,
  weightUnit,
}: Props & { energyUnit: EnergyUnit; weightUnit: FoodWeightUnit }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const locale = useFormattingLocale();
  const writes = useLocalFoodWrites();
  const toG = (value: number) => (weightUnit === 'oz' ? value * G_PER_OZ : value);
  const fromG = (grams: number) => (weightUnit === 'oz' ? grams / G_PER_OZ : grams);

  const [initial] = useState(() => ({
    name: recipe?.food.name ?? initialName,
    servings: recipe ? formDecimal(recipe.servingsCount, locale) : '',
    cooked: recipe?.cookedServingG ? formDecimal(fromG(recipe.cookedServingG), locale) : '',
    rawOverride: recipe?.rawServingGOverride ? formDecimal(fromG(recipe.rawServingGOverride), locale) : null,
  }));
  const [draftId] = useState(() =>
    createRecipeDraft({ recipeName: initial.name.trim(), ingredients: ingredientsFromRecipe(recipe) }),
  );
  const [initialIngredients] = useState(() => ingredientsFromRecipe(recipe));
  const draft = useRecipeDraft(draftId);
  // The draft ends with the editor: dropped on every way out (UX-26).
  const onCancel = () => {
    discardRecipeDraft(draftId);
    cancel();
  };
  const onSaved = (food: Food) => {
    discardRecipeDraft(draftId);
    saved(food);
  };
  const onDeleted = () => {
    discardRecipeDraft(draftId);
    deleted?.();
  };
  const ingredients = useMemo(() => draft?.ingredients ?? [], [draft]);
  const [name, setName] = useState(initial.name);
  const [servings, setServings] = useState(initial.servings);
  const [cooked, setCooked] = useState(initial.cooked);
  const [rawOverride, setRawOverride] = useState<string | null>(initial.rawOverride);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [discarding, setDiscarding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteFailed, setDeleteFailed] = useState(false);

  const parseOptional = (text: string) => (text.trim().length === 0 ? null : parseLocalizedDecimal(text, locale));
  const inRange = (value: number | null) => value !== null && value > 0 && value <= CUSTOM_FOOD_AMOUNT_MAX;
  const servingsCount = parseLocalizedDecimal(servings, locale);
  const cookedValue = parseOptional(cooked);
  const rawValue = rawOverride === null ? null : parseOptional(rawOverride);
  const errors = {
    name: name.trim().length === 0,
    servings: !inRange(servingsCount),
    cooked: cooked.trim().length > 0 && !inRange(cookedValue),
    raw: rawOverride !== null && rawOverride.trim().length > 0 && !inRange(rawValue),
  };
  const valid = !errors.name && !errors.servings && !errors.cooked && !errors.raw && ingredients.length > 0;
  const amounts = useMemo(() => ingredients.map(draftIngredientAmount), [ingredients]);
  const count = inRange(servingsCount) ? servingsCount! : 1;
  const computed = computeRecipe(amounts, {
    servingsCount: count,
    cookedServingG: null,
    rawServingGOverride: null,
  });
  const computedRaw = computedRawServingG(amounts, count);
  const ingredientKeys = (list: readonly DraftIngredient[]) =>
    JSON.stringify(list.map((item) => [item.key, item.servingId, item.quantity]));
  const dirty =
    name !== initial.name ||
    servings !== initial.servings ||
    cooked !== initial.cooked ||
    rawOverride !== initial.rawOverride ||
    ingredientKeys(ingredients) !== ingredientKeys(initialIngredients);

  const show = (field: keyof typeof errors) => errors[field] && touched[field];
  const changeName = (value: string) => {
    setName(value);
    setDraftRecipeName(draftId, value.trim());
  };
  const requestCancel = () => {
    if (dirty) setDiscarding(true);
    else onCancel();
  };
  const save = async () => {
    setTouched({ name: true, servings: true, cooked: true, raw: true });
    if (!valid) return;
    const labels = Object.fromEntries(
      RECIPE_UNITS.map((unit) => [unit, t(`recipe.units.${unit}`)]),
    ) as RecipeServingLabels;
    const input: RecipeInput = {
      name: name.trim(),
      servingsCount: servingsCount!,
      cookedServingG: cookedValue === null ? null : toG(cookedValue),
      rawServingGOverride: rawValue === null ? null : toG(rawValue),
      ingredients: ingredients.map((item) => ({
        foodId: item.food.id,
        servingId: item.servingId,
        quantity: item.quantity,
        snapshot: { servingUnit: item.servingUnit, basisMultiplier: item.basisMultiplierSnapshot },
      })),
      labels,
    };
    setSaving(true);
    setSaveFailed(false);
    try {
      onSaved(
        recipe
          ? await writes.updateRecipe.mutateAsync({ id: recipe.food.id, input })
          : await writes.createRecipe.mutateAsync(input),
      );
    } catch {
      setSaveFailed(true);
    } finally {
      setSaving(false);
    }
  };
  const remove = async () => {
    setConfirmingDelete(false);
    setDeleteFailed(false);
    try {
      await writes.deleteFood.mutateAsync(recipe!.food.id);
      onDeleted();
    } catch {
      setDeleteFailed(true);
    }
  };

  const weightLabel = t(`customFood.units.${weightUnit}`);
  const perServingUnit = t('recipe.perServingUnit', { unit: weightLabel });
  const rawHelper =
    rawOverride !== null
      ? t('recipe.rawOverride')
      : computedRaw !== null
        ? t('recipe.rawComputed')
        : t('recipe.rawUnknown', { unit: t(`recipe.units.${weightUnit}_raw`) });
  const padded = { paddingHorizontal: theme.spacing[4] };
  const energyText = (kcal: number) => `${formatEnergy(kcal, energyUnit, locale)} ${t(`diary.units.${energyUnit}`)}`;

  return (
    <View style={{ flex: 1 }}>
      <AppBar
        title={t(recipe ? 'recipe.editTitle' : 'recipe.title')}
        back={{ label: t('common.back'), onPress: requestCancel }}
        actions={
          <HeaderAction
            label={t('recipe.save')}
            onPress={() => void save()}
            disabled={!valid || saving || (recipe !== undefined && !dirty)}
            loading={saving}
            testID="recipe-save"
          />
        }
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView
          style={{ flex: 1 }}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingVertical: theme.spacing[4], gap: theme.spacing[4] }}
        >
          <View style={{ ...padded, gap: theme.spacing[4] }}>
            <FormField
              label={t('recipe.name')}
              value={name}
              onChangeText={changeName}
              onBlur={() => setTouched((current) => ({ ...current, name: true }))}
              autoCapitalize="words"
              autoFocus={!recipe}
              maxLength={CUSTOM_FOOD_NAME_MAX}
              error={show('name') ? t('recipe.errors.name') : undefined}
              testID="recipe-name"
            />
            <FormField
              label={t('recipe.servings')}
              value={servings}
              onChangeText={setServings}
              onBlur={() => setTouched((current) => ({ ...current, servings: true }))}
              keyboardType="decimal-pad"
              error={show('servings') ? t('recipe.errors.servings') : undefined}
              testID="recipe-servings"
            />
            <FormField
              label={t('recipe.cookedWeight')}
              value={cooked}
              onChangeText={setCooked}
              onBlur={() => setTouched((current) => ({ ...current, cooked: true }))}
              keyboardType="decimal-pad"
              unit={perServingUnit}
              helper={t('recipe.cookedHelper')}
              error={show('cooked') ? t('recipe.errors.weight') : undefined}
              testID="recipe-cooked"
            />
            <View style={{ gap: theme.spacing[1] }}>
              <FormField
                label={t('recipe.rawWeight')}
                value={rawOverride ?? (computedRaw !== null ? formDecimal(fromG(computedRaw), locale) : '')}
                onChangeText={setRawOverride}
                onBlur={() => setTouched((current) => ({ ...current, raw: true }))}
                keyboardType="decimal-pad"
                unit={perServingUnit}
                helper={rawHelper}
                error={show('raw') ? t('recipe.errors.weight') : undefined}
                testID="recipe-raw"
              />
              {rawOverride !== null ? (
                <TextAction label={t('recipe.reset')} onPress={() => setRawOverride(null)} testID="recipe-raw-reset" />
              ) : null}
            </View>
          </View>
          <View>
            <SectionHeader label={t('recipe.ingredients')} uppercase />
            {ingredients.map((ingredient) => (
              <IngredientRow
                key={ingredient.key}
                ingredient={ingredient}
                nutrients={scaleNutrients(
                  ingredient.food.nutrients,
                  ingredientFactor(draftIngredientAmount(ingredient)),
                )}
                energyText={energyText}
                locale={locale}
                onPress={() => onEditIngredient(draftId, ingredient)}
                onRemove={async () => {
                  removeDraftIngredient(draftId, ingredient.key);
                  return true;
                }}
              />
            ))}
            {ingredients.length === 0 && touched.servings ? (
              <AppText color="textSecondary" style={padded}>
                {t('recipe.noIngredients')}
              </AppText>
            ) : null}
            <View style={padded}>
              <TextAction
                icon="add"
                label={t('recipe.addIngredient')}
                onPress={() => onAddIngredient(draftId)}
                testID="recipe-add-ingredient"
              />
            </View>
          </View>
          {ingredients.length > 0 ? (
            <View>
              <SectionHeader label={t('recipe.perServing')} uppercase />
              <View style={{ ...padded, gap: theme.spacing[2] }}>
                <AppText variant="bodyStrong" tabular testID="recipe-per-serving">
                  {energyText(computed.perServing.energyKcal)}
                </AppText>
                <Macros nutrients={computed.perServing} locale={locale} />
                <AppText color="textSecondary" tabular testID="recipe-whole">
                  {t('recipe.wholeRecipe')} · {energyText(computed.total.energyKcal)}
                </AppText>
              </View>
            </View>
          ) : null}
          {saveFailed ? (
            <View style={padded}>
              <InlineStatus tone="error" message={t('recipe.saveError')} />
            </View>
          ) : null}
          {recipe ? (
            <View style={{ ...padded, gap: theme.spacing[2] }}>
              {deleteFailed ? <InlineStatus tone="error" message={t('foodSearch.deleteError')} /> : null}
              <TextAction
                label={t('recipe.delete')}
                tone="danger"
                onPress={() => setConfirmingDelete(true)}
                testID="recipe-delete"
              />
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
      <ConfirmationDialog
        visible={discarding}
        title={t('customFood.discardTitle')}
        confirmLabel={t('customFood.discard')}
        cancelLabel={t('customFood.keepEditing')}
        destructive
        onConfirm={onCancel}
        onCancel={() => setDiscarding(false)}
        testID="recipe-discard"
      />
      {recipe ? (
        <ConfirmationDialog
          visible={confirmingDelete}
          title={t('recipe.deleteTitle', { name: recipe.food.name })}
          body={t('recipe.deleteBody')}
          confirmLabel={t('recipe.delete')}
          cancelLabel={t('common.cancel')}
          destructive
          onConfirm={() => void remove()}
          onCancel={() => setConfirmingDelete(false)}
          testID="recipe-delete-dialog"
        />
      ) : null}
    </View>
  );
}

function Macros({ nutrients, locale }: { nutrients: Nutrients; locale: string }) {
  const { t } = useTranslation();
  const grams = (value: number | null) => (value === null ? '—' : `${formatGrams(value, locale)} g`);
  return (
    <AppText color="textSecondary" tabular>
      {t('foodDetail.carbs')} {grams(nutrients.carbohydrateG)} │ {t('foodDetail.protein')} {grams(nutrients.proteinG)} │{' '}
      {t('foodDetail.fat')} {grams(nutrients.fatG)}
    </AppText>
  );
}

/** UX-26 ingredient row (DS-09): name · amount + unit (or `Deleted food`) · kcal; swipe left → Remove. */
function IngredientRow({
  ingredient,
  nutrients,
  energyText,
  locale,
  onPress,
  onRemove,
}: {
  ingredient: DraftIngredient;
  nutrients: Nutrients;
  energyText: (kcal: number) => string;
  locale: string;
  onPress: () => void;
  onRemove: () => Promise<boolean>;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const quantity = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(ingredient.quantity);
  const amount = t(isMeasureLabel(ingredient.servingUnit) ? 'diary.entry.serving' : 'diary.entry.servings', {
    quantity,
    unit: ingredient.servingUnit,
  });
  const secondary = ingredient.food.isDeleted ? `${amount} · ${t('recipe.deletedFood')}` : amount;
  const energy = energyText(nutrients.energyKcal);
  return (
    <SwipeToDelete testID={`recipe-ingredient-swipe-${ingredient.key}`} label={t('recipe.remove')} onDelete={onRemove}>
      <FocusablePressable
        accessibilityRole="button"
        accessibilityLabel={`${ingredient.food.name}, ${secondary}, ${energy}`}
        accessibilityActions={[{ name: 'delete', label: t('recipe.remove') }]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'delete') void onRemove();
        }}
        onPress={onPress}
        testID={`recipe-ingredient-${ingredient.key}`}
        style={({ pressed }) => ({
          minHeight: 56,
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing[3],
          paddingHorizontal: theme.spacing[4],
          paddingVertical: theme.spacing[2],
          backgroundColor: pressed ? theme.colors.primaryTint : theme.colors.surface,
        })}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <AppText numberOfLines={1}>{ingredient.food.name}</AppText>
          <AppText variant="compact" color="textSecondary" numberOfLines={1}>
            {secondary}
          </AppText>
        </View>
        <AppText variant="compact" tabular>
          {energy}
        </AppText>
      </FocusablePressable>
    </SwipeToDelete>
  );
}
