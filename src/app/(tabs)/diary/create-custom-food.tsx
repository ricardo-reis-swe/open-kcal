import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { CreateCustomFoodScreen } from '@/features/food-search/screens/CreateCustomFoodScreen';
import { NotFoundState } from '@/shared/components';
import { parseRouteParams, routes } from '@/shared/navigation/routes';

/**
 * UX-08: create only, then continue to Food Detail without logging automatically (NAV-04).
 * With `ingredientDraftId` (POST-15, Diary stack) the saved food becomes an ingredient:
 * Save opens Ingredient Detail for the draft instead of Food Detail.
 */
export default function CreateCustomFoodRoute() {
  const { t } = useTranslation();
  const params = parseRouteParams('createCustomFood', useLocalSearchParams());
  if (!params)
    return <NotFoundState actionLabel={t('common.backToDiary')} onAction={() => router.dismissTo(routes.diary())} />;
  const draftId = params.ingredientDraftId;
  if (draftId) {
    return (
      <CreateCustomFoodScreen
        barcode={params.barcode}
        onCancel={() => router.back()}
        onSaved={(food) =>
          router.replace(
            routes.ingredientDetail({
              stack: 'diary',
              draftId,
              foodId: food.id,
              foodSource: food.source,
            }),
          )
        }
      />
    );
  }
  return (
    <CreateCustomFoodScreen
      initialName={params.initialName}
      barcode={params.barcode}
      onScan={() =>
        router.push(
          routes.barcodeScanner({
            mealId: params.mealId!,
            date: params.date!,
            origin: params.origin,
          }),
        )
      }
      onCancel={() => router.back()}
      onSaved={(food) =>
        router.replace(
          routes.foodDetail({
            foodId: food.id,
            foodSource: food.source,
            mealId: params.mealId!,
            date: params.date!,
            origin: params.origin,
          }),
        )
      }
    />
  );
}
