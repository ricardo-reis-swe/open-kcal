// UX-13 Date Picker: the native calendar with Cancel, Done and a Today shortcut. The one place that touches
// `@react-native-community/datetimepicker` (ARCH-20: third-party UI sits behind an internal component).
// iOS: the inline calendar inside our BottomSheet (ARCH-06). Android: the platform calendar dialog, whose
// buttons are Cancel / Done with Today as the neutral button.
import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { AppText, BottomSheet, TextAction } from '@/shared/components';
import { localDateTime, toLocalDate, type LocalDate } from '@/shared/dates';
import { useFormattingLocale } from '@/shared/i18n/useFormattingLocale';
import { useTheme } from '@/shared/theme';

export type DatePickerProps = {
  visible: boolean;
  /** Opens on this date (NAV-05: the active date). Any date is allowed. */
  value: LocalDate;
  today: LocalDate;
  /** `Choose date` by default; destination mode (Copy Meal, UX-12) only changes the title. */
  title?: string;
  onConfirm: (date: LocalDate) => void;
  onCancel: () => void;
};

// Local noon: a calendar date never shifts across a DST change or a timezone edge.
const toPickerDate = (date: LocalDate) => localDateTime(date, 12);

export function DatePicker(props: DatePickerProps) {
  return Platform.OS === 'android' ? <AndroidDatePicker {...props} /> : <IosDatePicker {...props} />;
}

function AndroidDatePicker({ visible, value, today, onConfirm, onCancel }: DatePickerProps) {
  const { t } = useTranslation();
  // The dialog calls back once; keep the latest handlers without reopening it.
  const handlers = useRef({ onConfirm, onCancel, today });
  useEffect(() => {
    handlers.current = { onConfirm, onCancel, today };
  });
  useEffect(() => {
    if (!visible) return;
    DateTimePickerAndroid.open({
      value: toPickerDate(value),
      mode: 'date',
      positiveButton: { label: t('datePicker.done') },
      negativeButton: { label: t('common.cancel') },
      neutralButton: { label: t('datePicker.today') },
      onChange: (event: DateTimePickerEvent, picked?: Date) => {
        const { onConfirm: confirm, onCancel: cancel, today: now } = handlers.current;
        if (event.type === 'set' && picked) confirm(toLocalDate(picked));
        else if (event.type === 'neutralButtonPressed') confirm(now);
        else cancel();
      },
    });
    // Opens once per `visible` change; the value is read at open time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);
  return null;
}

function IosDatePicker({ visible, value, today, title, onConfirm, onCancel }: DatePickerProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const locale = useFormattingLocale();
  const [draft, setDraft] = useState(value);
  const [openedWith, setOpenedWith] = useState<LocalDate | null>(null);
  // Re-open on the active date each time (NAV-05), without an effect that sets state.
  if (visible && openedWith !== value) {
    setOpenedWith(value);
    setDraft(value);
  }
  if (!visible && openedWith !== null) setOpenedWith(null);
  const heading = title ?? t('datePicker.title');
  // DS-11: at large text the calendar and actions outgrow the sheet, so the content scrolls and the actions wrap.
  // Only then: at default sizes the whole sheet stays the swipe-down surface.
  const window = useWindowDimensions();
  const large = window.fontScale >= 1.5;
  const Body = large ? ScrollView : View;
  return (
    <BottomSheet
      visible={visible}
      onClose={onCancel}
      accessibilityLabel={heading}
      closeLabel={t('common.cancel')}
      testID="date-picker"
    >
      <Body style={large ? { maxHeight: window.height * 0.8 } : undefined}>
        <View style={{ paddingHorizontal: theme.spacing[4], gap: theme.spacing[2] }}>
          <AppText variant="sectionTitle" accessibilityRole="header">
            {heading}
          </AppText>
          <DateTimePicker
            testID="date-picker-calendar"
            value={toPickerDate(draft)}
            mode="date"
            // The inline calendar has a native minimum width wider than a phone at the largest (AX) sizes; the native
            // wheel fits, so large text switches to it (DS-11).
            display={large ? 'spinner' : 'inline'}
            locale={locale}
            themeVariant={theme.scheme}
            // Keep the native calendar to the sheet width (its intrinsic width outgrows the screen at AX sizes).
            style={styles.calendar}
            accentColor={theme.colors.primary}
            onChange={(_event: DateTimePickerEvent, picked?: Date) => {
              if (picked) setDraft(toLocalDate(picked));
            }}
          />
          <View style={[styles.actions, { gap: theme.spacing[2], paddingBottom: theme.spacing[2] }]}>
            <TextAction label={t('common.cancel')} onPress={onCancel} testID="date-picker-cancel" />
            <TextAction
              label={t('datePicker.today')}
              accessibilityHint={t('datePicker.todayHint')}
              onPress={() => onConfirm(today)}
              testID="date-picker-today"
            />
            <View style={styles.grow} />
            <TextAction label={t('datePicker.done')} onPress={() => onConfirm(draft)} testID="date-picker-done" />
          </View>
        </View>
      </Body>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  calendar: { alignSelf: 'stretch' },
  grow: { flex: 1 },
});
