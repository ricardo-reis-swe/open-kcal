import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { CreateCustomFoodScreen } from '@/features/food-search/screens/CreateCustomFoodScreen';
import { NotFoundState } from '@/shared/components';
import { parseRouteParams, routes } from '@/shared/navigation/routes';

/** UX-08: create only, then continue to Food Detail without logging automatically (NAV-04). */
export default function CreateCustomFoodRoute() {
  const { t } = useTranslation();
  const params = parseRouteParams('createCustomFood', useLocalSearchParams());
  if (!params)
    return <NotFoundState actionLabel={t('common.backToDiary')} onAction={() => router.dismissTo(routes.diary())} />;
  return (
    <CreateCustomFoodScreen
      initialName={params.initialName}
      onCancel={() => router.back()}
      onSaved={(food) =>
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
    />
  );
}
