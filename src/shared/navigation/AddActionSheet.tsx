import { useTranslation } from 'react-i18next';

import { BottomSheet } from '@/shared/components';

type Props = { visible: boolean; onClose: () => void };

/**
 * Add Action Sheet opened by `+` from either tab (NAV-03). M0 ships the empty sheet;
 * Add Food, Quick Calories and Update Weight rows arrive with their flows (M3–M8).
 */
export function AddActionSheet({ visible, onClose }: Props) {
  const { t } = useTranslation();
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      accessibilityLabel={t('addActions.sheetLabel')}
      closeLabel={t('common.close')}
      testID="add-action-sheet"
    >
      {null}
    </BottomSheet>
  );
}
