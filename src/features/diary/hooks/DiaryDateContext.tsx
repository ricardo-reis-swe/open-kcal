// NAV-05 / ARCH-06: the selected diary date lives in one Diary-scoped context above the Diary stack (in the tabs layout,
// so the global `+` flows use it too, NAV-03). It survives
// Meal Detail, search, add/edit and tab switches. Screens never keep competing date state.
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { useServices } from '@/bootstrap/services';
import { addDays, localDateTime, todayLocal, type Clock, type LocalDate } from '@/shared/dates';

type DiaryDateValue = {
  date: LocalDate;
  /** Today per the injected clock; refreshed when the app becomes active and at local midnight. */
  today: LocalDate;
  setDate: (date: LocalDate) => void;
};

const DiaryDateContext = createContext<DiaryDateValue | null>(null);

/**
 * UX-02: "Today"/"Yesterday" labels and the Today action follow the real date, so an app left open overnight or
 * resumed the next day relabels its days. The selected date itself never jumps (NAV-05: it stays in context).
 */
function useToday(clock: Clock): LocalDate {
  const [today, setToday] = useState(() => todayLocal(clock));
  useEffect(() => {
    const refresh = () => setToday(todayLocal(clock));
    let timer: ReturnType<typeof setTimeout> | undefined;
    const scheduleMidnight = () => {
      const next = localDateTime(addDays(todayLocal(clock), 1), 0);
      // +1 s so the timer never fires a hair before midnight.
      timer = setTimeout(
        () => {
          refresh();
          scheduleMidnight();
        },
        Math.max(0, next.getTime() - clock.now().getTime()) + 1000,
      );
    };
    scheduleMidnight();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      refresh();
      clearTimeout(timer);
      scheduleMidnight();
    });
    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, [clock]);
  return today;
}

export function DiaryDateProvider({ children }: { children: ReactNode }) {
  const { clock } = useServices();
  const today = useToday(clock);
  // Fresh launch = today (NAV-05).
  const [date, setDate] = useState<LocalDate>(today);
  const value = useMemo(() => ({ date, today, setDate }), [date, today]);
  return <DiaryDateContext.Provider value={value}>{children}</DiaryDateContext.Provider>;
}

export function useDiaryDate(): DiaryDateValue {
  const value = useContext(DiaryDateContext);
  if (!value) throw new Error('useDiaryDate must be used inside DiaryDateProvider');
  return value;
}
