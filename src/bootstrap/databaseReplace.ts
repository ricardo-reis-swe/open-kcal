// DATA-32 / ARCH-25: StartupGate owns stop → swap → restart, so no screen ever holds a closed database. Screens ask
// for it through this context; it is provided only while the gate is `ready`.
import { createContext, useContext } from 'react';

export type ReplaceDatabase = (stagedPath: string) => void;

export const DatabaseReplaceContext = createContext<ReplaceDatabase | null>(null);

/** Hands a staged, validated file (DATA-31) to the gate. The caller's screen unmounts; nothing runs after the call. */
export function useReplaceDatabase(): ReplaceDatabase {
  const replace = useContext(DatabaseReplaceContext);
  if (!replace) throw new Error('useReplaceDatabase must be used inside StartupGate');
  return replace;
}
