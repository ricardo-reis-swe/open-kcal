// NAV-10: how many app overlays (sheets, dialogs) are open, so a widget tap never changes what's under one.
import { useEffect } from 'react';

let openCount = 0;

/** Counts the calling overlay as open while `visible`. */
export function useOverlayPresence(visible: boolean): void {
  useEffect(() => {
    if (!visible) return;
    openCount += 1;
    return () => {
      openCount -= 1;
    };
  }, [visible]);
}

export function isOverlayOpen(): boolean {
  return openCount > 0;
}
