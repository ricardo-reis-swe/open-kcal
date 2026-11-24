// DATA-32 / UX-29: one-shot notices that bootstrap writes (import finished, rolled back, interrupted) and the Diary
// shows once as a toast. Lives in shared/ because bootstrap writes it and a feature reads it (ARCH-05).
import { useSyncExternalStore } from 'react';

export type AppNoticeKind = 'dataImported' | 'importFailed' | 'importInterrupted';
export type AppNotice = { key: number; kind: AppNoticeKind };

let notice: AppNotice | null = null;
let nextKey = 0;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((listener) => listener());

export function announceAppNotice(kind: AppNoticeKind): void {
  nextKey += 1;
  notice = { key: nextKey, kind };
  emit();
}

export function clearAppNotice(key: number): void {
  if (notice?.key !== key) return;
  notice = null;
  emit();
}

export function useAppNotice(): AppNotice | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => notice,
  );
}
