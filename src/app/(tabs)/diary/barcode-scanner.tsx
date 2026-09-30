import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { BarcodeScannerScreen } from '@/features/food-search/screens/BarcodeScannerScreen';
import { NotFoundState } from '@/shared/components';
import { parseRouteParams, routes } from '@/shared/navigation/routes';

/** UX-24 over Food Search. Found and Create custom food **replace** the scanner, so they return to Food Search (NAV-04). */
export default function BarcodeScannerRoute() {
  const { t } = useTranslation();
  const params = parseRouteParams('barcodeScanner', useLocalSearchParams());
  if (!params)
    return <NotFoundState actionLabel={t('common.backToDiary')} onAction={() => router.dismissTo(routes.diary())} />;
  return (
    <BarcodeScannerScreen
      onBack={() => router.back()}
      onFound={(food) =>
        router.replace(
          routes.foodDetail({
            foodId: food.id,
            foodSource: food.source,
            mealId: params.mealId,
            date: params.date,
            origin: params.origin,
          }),
        )
      }
      onCreateCustom={(barcode) =>
        router.replace(
          routes.createCustomFood({ mealId: params.mealId, date: params.date, barcode, origin: params.origin }),
        )
      }
    />
  );
}
