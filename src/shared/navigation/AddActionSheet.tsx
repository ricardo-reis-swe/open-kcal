import { useTranslation } from 'react-i18next';

import { BottomSheet, ListRow } from '@/shared/components';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Fires once the sheet is fully closed, so the next sheet or route opens after it (NAV-03). */
  onDismissed?: () => void;
  /** Each action row is disabled until its flow lands: Add food (M4), Update weight (M8). */
  onAddFood?: () => void;
  onScanBarcode?: () => void;
  onQuickCalories?: () => void;
  onUpdateWeight?: () => void;
};

/** Add Action Sheet opened by `+` from either tab (UX-09, NAV-03): icon + label rows, no title. */
export function AddActionSheet({
  visible,
  onClose,
  onDismissed,
  onAddFood,
  onScanBarcode,
  onQuickCalories,
  onUpdateWeight,
}: Props) {
  const { t } = useTranslation();
  const rows = [
    { key: 'add-food', label: t('addActions.addFood'), icon: 'restaurant-outline', onPress: onAddFood },
    { key: 'scan-barcode', label: t('addActions.scanBarcode'), icon: 'barcode-outline', onPress: onScanBarcode },
    { key: 'quick-calories', label: t('addActions.quickCalories'), icon: 'flash-outline', onPress: onQuickCalories },
    { key: 'update-weight', label: t('addActions.updateWeight'), icon: 'scale-outline', onPress: onUpdateWeight },
  ] as const;
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      onDismissed={onDismissed}
      accessibilityLabel={t('addActions.sheetLabel')}
      closeLabel={t('common.close')}
      testID="add-action-sheet"
    >
      {rows.map((row) => (
        <ListRow
          key={row.key}
          label={row.label}
          icon={row.icon}
          onPress={row.onPress ?? noop}
          disabled={!row.onPress}
          testID={`add-action-${row.key}`}
        />
      ))}
    </BottomSheet>
  );
}

const noop = () => undefined;
