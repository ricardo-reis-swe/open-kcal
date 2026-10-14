import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { BarcodeScannerScreen } from '@/features/food-search/screens/BarcodeScannerScreen';
import { NotFoundState } from '@/shared/components';
import { parseRouteParams, routes } from '@/shared/navigation/routes';

/**
 * UX-24 over Food Search. Found and Create custom food **replace** the scanner, so they return to
 * Food Search (NAV-04). With `ingredientDraftId` (POST-15, Diary stack) the outcomes open the
 * recipe's Ingredient Detail / Create Custom Food instead, writing into that draft.
 */
export default function BarcodeScannerRoute() {
  const { t } = useTranslation();
  const params = parseRouteParams('barcodeScanner', useLocalSearchParams());
  if (!params)
    return <NotFoundState actionLabel={t('common.backToDiary')} onAction={() => router.dismissTo(routes.diary())} />;
  const draftId = params.ingredientDraftId;
  if (draftId) {
    return (
      <BarcodeScannerScreen
        onBack={() => router.back()}
        onFound={(food) =>
          router.replace(
            routes.ingredientDetail({
              stack: 'diary',
              draftId,
              foodId: food.id,
              foodSource: food.source,
              ...(food.externalId ? { externalId: food.externalId } : {}),
            }),
          )
        }
        onCreateCustom={(barcode) =>
          router.replace(routes.createCustomFood({ barcode, origin: params.origin, ingredientDraftId: draftId }))
        }
      />
    );
  }
  return (
    <BarcodeScannerScreen
      onBack={() => router.back()}
      onFound={(food) =>
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
      onCreateCustom={(barcode) =>
        router.replace(
          routes.createCustomFood({
            mealId: params.mealId!,
            date: params.date!,
            barcode,
            origin: params.origin,
          }),
        )
      }
    />
  );
}
