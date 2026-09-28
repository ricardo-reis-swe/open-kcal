// PROV-08 / UX-04: holds the merged `Online` list so late provider responses append, never reshuffle.
import { useEffect, useState } from 'react';

import type { ProviderPages } from './food-search.queries';
import { appendOnline, type OnlineBatch, type OnlineItem, type OnlineProvider } from './online-results';

/** PROV-08: wait this long after the first remote response for the other provider's pending request. */
export const ONLINE_MERGE_WAIT_MS = 1_500;

type MergeState = { query: string; shown: OnlineItem[]; consumed: string[] };

export type OnlineResults = {
  items: OnlineItem[];
  /** A request or a merge is still pending for the current query. */
  loading: boolean;
  /** Every expected request settled (no pending merge). */
  settled: boolean;
  errors: { provider: OnlineProvider; error: unknown; retry: () => void }[];
  hasMore: boolean;
};

export function useOnlineResults(query: string, providers: ProviderPages[], online: boolean): OnlineResults {
  const q = query.trim();
  // A provider whose threshold is met but whose debounce hasn't caught up still counts as pending.
  const expected = providers.filter((p) => online && q.length >= p.minLength);
  let pendingCount = 0;
  const settledBatches: { version: string; batch: OnlineBatch }[] = [];
  const errors: OnlineResults['errors'] = [];
  for (const p of expected) {
    if (p.query !== q) {
      pendingCount += 1;
      continue;
    }
    p.results.forEach((result, index) => {
      if (result.status === 'pending') pendingCount += 1;
      else {
        const stamp = result.status === 'success' ? `s${result.dataUpdatedAt}` : `e${result.errorUpdatedAt}`;
        const items: OnlineItem[] = (result.data?.candidates ?? []).map((candidate) => ({
          provider: p.provider,
          externalId: candidate.externalId,
          input: candidate.input,
          barcode: p.provider === 'open_food_facts' ? candidate.externalId : (candidate.barcode ?? null),
        }));
        settledBatches.push({ version: `${p.provider}:${index + 1}:${stamp}`, batch: { provider: p.provider, items } });
      }
    });
    const failed = p.results.filter((result) => result.status === 'error');
    if (failed.length > 0)
      errors.push({
        provider: p.provider,
        error: failed[0]!.error,
        retry: () => void Promise.all(failed.map((result) => result.refetch())),
      });
  }
  const [state, setState] = useState<MergeState>({ query: q, shown: [], consumed: [] });
  const [expiredRound, setExpiredRound] = useState<string | null>(null);
  const current: MergeState = state.query === q ? state : { query: q, shown: [], consumed: [] };
  const fresh = settledBatches.filter((entry) => !current.consumed.includes(entry.version));
  const roundId = `${q}#${current.consumed.length}`;
  const waiting = fresh.length > 0 && pendingCount > 0;
  useEffect(() => {
    if (!waiting) return;
    const timer = setTimeout(() => setExpiredRound(roundId), ONLINE_MERGE_WAIT_MS);
    return () => clearTimeout(timer);
  }, [waiting, roundId]);
  let view = current;
  if (fresh.length > 0 && (pendingCount === 0 || expiredRound === roundId)) {
    view = {
      query: q,
      shown: appendOnline(
        current.shown,
        fresh.map((entry) => entry.batch),
        q,
      ),
      consumed: [...current.consumed, ...fresh.map((entry) => entry.version)],
    };
    setState(view); // render-phase update (derived state); the next render sees no fresh batches
  }
  const merging = view !== current ? false : fresh.length > 0;
  return {
    items: view.shown,
    loading: pendingCount > 0 || merging,
    settled: pendingCount === 0 && !merging,
    errors,
    hasMore: expected.some((p) => p.query === q && p.hasMore),
  };
}
