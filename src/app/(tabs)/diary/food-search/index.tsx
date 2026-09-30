import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { FoodSearchScreen } from '@/features/food-search/screens/FoodSearchScreen';
import { NotFoundState } from '@/shared/components';
import { parseRouteParams, routes } from '@/shared/navigation/routes';
import { useDiaryDate } from '@/features/diary/hooks/DiaryDateContext';

/** UX-04 Food Search route. All continuations preserve the selected date and meal (NAV-04/05). */
export default function FoodSearchRoute() {
  const { t } = useTranslation();
  const params = parseRouteParams('foodSearch', useLocalSearchParams());
  const { today } = useDiaryDate();
  if (!params)
    return <NotFoundState actionLabel={t('common.backToDiary')} onAction={() => router.dismissTo(routes.diary())} />;
  const back = () => (params.origin === 'profile' ? router.replace(routes.profile()) : router.back());
  return (
    <FoodSearchScreen
      mealId={params.mealId}
      date={params.date}
      today={today}
      initialQuery={params.initialQuery}
      autoFocus={!params.scan}
      onBack={back}
      onScan={() =>
        router.push(routes.barcodeScanner({ mealId: params.mealId, date: params.date, origin: params.origin }))
      }
      onQuickCalories={() =>
        router.push(routes.quickCalories({ mealId: params.mealId, date: params.date, origin: 'diary' }))
      }
      onCreateCustom={(initialName) =>
        router.push(
          routes.createCustomFood({ mealId: params.mealId, date: params.date, initialName, origin: params.origin }),
        )
      }
      onFoodDatabases={() => router.navigate(routes.foodDatabases())}
      onSelectFood={(food) =>
        router.push(
          routes.foodDetail({
            foodId: food.id,
            foodSource: food.source,
            mealId: params.mealId,
            date: params.date,
            origin: params.origin,
          }),
        )
      }
      onSelectExternal={(foodSource, externalId) =>
        router.push(
          routes.foodDetail({
            foodId: externalId,
            externalId,
            foodSource,
            mealId: params.mealId,
            date: params.date,
            origin: params.origin,
          }),
        )
      }
    />
  );
}
