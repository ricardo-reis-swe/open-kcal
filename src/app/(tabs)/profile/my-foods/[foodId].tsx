import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { Food } from '@/data/db/repositories/foodsRepository';
import { useFood } from '@/features/food-search/food-search.queries';
import { CreateCustomFoodScreen } from '@/features/food-search/screens/CreateCustomFoodScreen';
import { NotFoundState } from '@/shared/components';
import { parseRouteParams, routes } from '@/shared/navigation/routes';

/** UX-25: a custom food's details in the UX-08 form (edit mode). Save, delete and back return to My foods. */
export default function EditCustomFoodRoute() {
  const { t } = useTranslation();
  const params = parseRouteParams('editCustomFood', useLocalSearchParams());
  const food = useFood(params?.foodId ?? '', Boolean(params));
  // The form keeps the food it opened with: the refetch after this screen's own save or delete must not swap the
  // form or flash the not-found state while it leaves.
  const [opened, setOpened] = useState<Food | null>(null);
  const valid = food.data && !food.data.isDeleted && food.data.source === 'custom';
  if (!opened && valid) setOpened(food.data!);
  if (opened)
    return (
      <CreateCustomFoodScreen
        food={opened}
        onCancel={() => router.back()}
        onSaved={() => router.back()}
        onDeleted={() => router.back()}
      />
    );
  // UX-00: bad params, or a deleted / non-custom food.
  if (!params || food.isError || (food.data && !valid))
    return (
      <NotFoundState actionLabel={t('common.backToProfile')} onAction={() => router.dismissTo(routes.profile())} />
    );
  return null;
}
