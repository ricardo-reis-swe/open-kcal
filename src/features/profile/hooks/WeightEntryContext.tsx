// NAV-07 Weight Entry Sheet: one app-level sheet opened from `+` (NAV-03), Profile and Weight History (NAV-06).
// It lives in the tabs layout (like the `+` flows) so every entry point opens the same sheet over the current screen.
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

import { useDiaryDate } from '@/features/diary/hooks/DiaryDateContext';

import { WeightEntrySheet, type WeightEntryTarget } from '../components/WeightEntrySheet';

type OpenWeightEntry = (target: WeightEntryTarget) => void;

const WeightEntryContext = createContext<OpenWeightEntry | null>(null);

export function WeightEntryProvider({ children }: { children: ReactNode }) {
  const { today } = useDiaryDate();
  // `key` remounts the sheet per open, so each open starts from a fresh form (create) or the stored record (edit).
  const [open, setOpen] = useState<{ target: WeightEntryTarget; key: number } | null>(null);
  const [visible, setVisible] = useState(false);
  const openWeightEntry = useCallback<OpenWeightEntry>((target) => {
    setOpen((current) => ({ target, key: (current?.key ?? 0) + 1 }));
    setVisible(true);
  }, []);
  return (
    <WeightEntryContext.Provider value={openWeightEntry}>
      {children}
      {open ? (
        <WeightEntrySheet
          key={open.key}
          visible={visible}
          target={open.target}
          today={today}
          onClose={() => setVisible(false)}
        />
      ) : null}
    </WeightEntryContext.Provider>
  );
}

/** Opens the Weight Entry Sheet: create (defaults to today, NAV-03) or edit a stored entry (NAV-06). */
export function useOpenWeightEntry(): OpenWeightEntry {
  const open = useContext(WeightEntryContext);
  if (!open) throw new Error('useOpenWeightEntry must be used inside WeightEntryProvider');
  return open;
}
