// NAV-05 / ARCH-06: the selected diary date lives in one Diary-scoped context above the Diary stack, so it survives
// Meal Detail, search, add/edit and tab switches. Screens never keep competing date state.
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import { useServices } from '@/bootstrap/services';
import { todayLocal, type LocalDate } from '@/shared/dates';

type DiaryDateValue = {
  date: LocalDate;
  /** Today per the injected clock, read on every render so a day rollover is picked up on the next render. */
  today: LocalDate;
  setDate: (date: LocalDate) => void;
};

const DiaryDateContext = createContext<DiaryDateValue | null>(null);

export function DiaryDateProvider({ children }: { children: ReactNode }) {
  const { clock } = useServices();
  const today = todayLocal(clock);
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
