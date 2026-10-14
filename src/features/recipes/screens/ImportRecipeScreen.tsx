import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useTranslation } from 'react-i18next';
import * as Clipboard from 'expo-clipboard';
import { ScrollView, View } from 'react-native';

import { RECIPE_UNITS } from '@/domain/food/recipe';
import { useLocalFoodWrites } from '@/features/food-search/food-search.queries';
import {
  AppBar,
  AppText,
  ConfirmationDialog,
  FormField,
  InlineStatus,
  PrimaryButton,
  TextAction,
  UndoToast,
} from '@/shared/components';
import { formatEnergy, formatGrams } from '@/shared/i18n/format';
import { useFormattingLocale } from '@/shared/i18n/useFormattingLocale';
import { useTheme } from '@/shared/theme';
import type { RecipeServingLabels } from '@/domain/food/recipe';

import { parseRecipeText, type ParsedRecipe } from '../recipeText';

type Props = { onBack: () => void; onImported: () => void };

export function ImportRecipeScreen({ onBack, onImported }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const locale = useFormattingLocale();
  const writes = useLocalFoodWrites();
  const navigation = useNavigation();
  const [text, setText] = useState('');
  const [preview, setPreview] = useState<ParsedRecipe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [imported, setImported] = useState(false);
  const pendingAction = useRef<Parameters<typeof navigation.dispatch>[0] | null>(null);
  usePreventRemove(text.trim().length > 0 && !imported, ({ data }) => {
    pendingAction.current = data.action;
    setDiscarding(true);
  });

  const parse = useCallback((value: string) => {
    setText(value);
    setError(null);
    try {
      setPreview(parseRecipeText(value));
    } catch {
      setPreview(null);
    }
  }, []);
  useEffect(() => {
    let active = true;
    void Clipboard.getStringAsync()
      .then((value) => {
        if (!active) return;
        setReading(false);
        if (value) parse(value);
      })
      .catch(() => {
        if (active) setReading(false);
      });
    return () => {
      active = false;
    };
  }, [parse]);

  const labels = useMemo(
    () => Object.fromEntries(RECIPE_UNITS.map((unit) => [unit, t(`recipe.units.${unit}`)])) as RecipeServingLabels,
    [t],
  );
  const paste = async () => {
    try {
      parse(await Clipboard.getStringAsync());
    } catch {
      /* Paste fallback stays available. */
    }
  };
  const importRecipe = async () => {
    setError(null);
    let parsed: ParsedRecipe;
    try {
      parsed = parseRecipeText(text);
    } catch {
      setPreview(null);
      setError(t('importRecipe.invalid'));
      return;
    }
    setSaving(true);
    try {
      await writes.importRecipe.mutateAsync({
        name: parsed.name,
        servingsCount: parsed.servingsCount,
        cookedServingG: parsed.cookedServingG,
        rawServingGOverride: parsed.rawServingGOverride,
        labels,
        nutrition: parsed.nutrition.perServing,
        ingredients: parsed.ingredients.map((ingredient) => ({
          name: ingredient.name,
          brand: ingredient.brand,
          basisQuantity: ingredient.basisQuantity,
          basisUnit: ingredient.basisUnit,
          nutrients: ingredient.nutrients,
          servings: ingredient.servings,
          quantity: ingredient.quantity,
          servingUnit: ingredient.servingUnit,
          servingBasisMultiplier: ingredient.servingBasisMultiplier,
        })),
      });
      setToast(true);
      setImported(true);
    } catch {
      setError(t('importRecipe.saveError'));
    } finally {
      setSaving(false);
    }
  };
  const energyText = (energyKcal: number) => `${formatEnergy(energyKcal, 'kcal', locale)} ${t('diary.units.kcal')}`;
  const rawWeight =
    preview?.rawServingGOverride ??
    (preview && preview.ingredients.every((item) => item.basisUnit === 'g')
      ? preview.ingredients.reduce(
          (sum, item) => sum + item.basisQuantity * item.servingBasisMultiplier * item.quantity,
          0,
        ) / preview.servingsCount
      : null);
  const macroText = (nutrients: { carbohydrateG: number | null; proteinG: number | null; fatG: number | null }) => {
    const value = (amount: number | null) => (amount === null ? '—' : `${formatGrams(amount, locale)} g`);
    return `${t('foodDetail.carbs')} ${value(nutrients.carbohydrateG)} │ ${t('foodDetail.protein')} ${value(nutrients.proteinG)} │ ${t('foodDetail.fat')} ${value(nutrients.fatG)}`;
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.canvas }}>
      <AppBar
        title={t('importRecipe.title')}
        back={{ label: t('common.back'), onPress: () => (text.trim() ? setDiscarding(true) : onBack()) }}
      />
      <ScrollView
        contentContainerStyle={{ padding: theme.spacing[4], gap: theme.spacing[4] }}
        keyboardShouldPersistTaps="handled"
      >
        {!preview ? (
          <>
            <AppText color="textSecondary">
              {t(reading ? 'importRecipe.readingClipboard' : 'importRecipe.pasteHelp')}
            </AppText>
            <FormField
              label={t('importRecipe.textLabel')}
              value={text}
              onChangeText={parse}
              multiline
              textAlignVertical="top"
              autoCapitalize="none"
              autoCorrect={false}
              testID="import-recipe-text"
            />
            <TextAction label={t('importRecipe.paste')} onPress={() => void paste()} testID="import-recipe-paste" />
          </>
        ) : (
          <>
            <AppText variant="sectionTitle">{preview.name}</AppText>
            <AppText color="textSecondary">{t('importRecipe.senderUnverified')}</AppText>
            <AppText>{t('importRecipe.servings', { count: preview.servingsCount })}</AppText>
            {preview.cookedServingG ? (
              <AppText>
                {t('importRecipe.cookedWeight', { weight: formatGrams(preview.cookedServingG, locale) })}
              </AppText>
            ) : null}
            {rawWeight !== null ? (
              <AppText>{t('importRecipe.rawWeight', { weight: formatGrams(rawWeight, locale) })}</AppText>
            ) : null}
            <AppText variant="label" color="textSecondary">
              {t('recipe.ingredients')}
            </AppText>
            {preview.ingredients.map((ingredient, index) => (
              <View key={`${ingredient.name}-${index}`} style={{ gap: theme.spacing[1] }}>
                <AppText>{ingredient.name}</AppText>
                <AppText variant="compact" color="textSecondary">
                  {t('importRecipe.ingredientAmount', {
                    quantity: new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(ingredient.quantity),
                    unit: ingredient.servingUnit,
                  })}
                </AppText>
              </View>
            ))}
            <AppText variant="label" color="textSecondary">
              {t('importRecipe.senderNutrition')}
            </AppText>
            <AppText>
              {t('importRecipe.perServing', { value: energyText(preview.nutrition.perServing.energyKcal) })}
            </AppText>
            <AppText color="textSecondary">{macroText(preview.nutrition.perServing)}</AppText>
            <AppText>{t('importRecipe.total', { value: energyText(preview.nutrition.total.energyKcal) })}</AppText>
            <TextAction label={t('importRecipe.editText')} onPress={() => setPreview(null)} />
          </>
        )}
        {error ? <InlineStatus tone="error" message={error} /> : null}
        <PrimaryButton
          label={t('importRecipe.import')}
          onPress={() => void importRecipe()}
          disabled={!text.trim() || saving}
          loading={saving}
          fullWidth
          testID="import-recipe-confirm"
        />
      </ScrollView>
      {toast ? (
        <UndoToast
          message={t('importRecipe.imported')}
          durationMs={1_200}
          onDismiss={() => {
            setToast(false);
            onImported();
          }}
        />
      ) : null}
      <ConfirmationDialog
        visible={discarding}
        title={t('customFood.discardTitle')}
        confirmLabel={t('customFood.discard')}
        cancelLabel={t('customFood.keepEditing')}
        destructive
        onConfirm={() => {
          setDiscarding(false);
          if (pendingAction.current) {
            navigation.dispatch(pendingAction.current);
            pendingAction.current = null;
          } else onBack();
        }}
        onCancel={() => {
          pendingAction.current = null;
          setDiscarding(false);
        }}
        testID="import-recipe-discard"
      />
    </View>
  );
}
