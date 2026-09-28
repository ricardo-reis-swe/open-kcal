// PROV-08 / UX-04: the merged `Online` Food Search list (ranking, interleave, dedupe, append-only).
import type { FoodInput } from '@/data/db/repositories/foodsRepository';

export type OnlineProvider = 'usda' | 'open_food_facts';

/** Round-robin order within a tier (PROV-08: USDA first). */
const PROVIDER_ORDER: OnlineProvider[] = ['usda', 'open_food_facts'];

export type OnlineItem = {
  provider: OnlineProvider;
  externalId: string;
  input: FoodInput;
  /** OFF `code` / USDA Branded `gtinUpc`; only used for cross-provider dedupe. */
  barcode?: string | null;
};

/** One provider page, in the provider's own relevance order (USDA generic promotion already applied). */
export type OnlineBatch = { provider: OnlineProvider; items: OnlineItem[] };

export const onlineItemKey = (item: Pick<OnlineItem, 'provider' | 'externalId'>) =>
  `${item.provider}:${item.externalId}`;

/** Digits only, leading zeros stripped; `null` when nothing usable remains. */
export function normalizeBarcode(value: string | null | undefined): string | null {
  const digits = (value ?? '').replace(/\D/g, '').replace(/^0+/, '');
  return digits.length > 0 ? digits : null;
}

const normalizeText = (value: string) => value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();

/** PROV-08 local name tiers: 0 equals → 1 starts with → 2 every token starts a word → 3 other. */
export function matchTier(name: string, query: string): 0 | 1 | 2 | 3 {
  const n = normalizeText(name);
  const q = normalizeText(query);
  if (!q) return 3;
  if (n === q) return 0;
  if (n.startsWith(q)) return 1;
  const words = n.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const tokens = q.split(' ');
  if (tokens.every((token) => words.some((word) => word.startsWith(token)))) return 2;
  return 3;
}

/** Ranks one group of items: tier first, then round-robin between providers keeping each one's order. */
export function rankOnline(items: OnlineItem[], query: string): OnlineItem[] {
  const tiers: OnlineItem[][][] = [0, 1, 2, 3].map(() => PROVIDER_ORDER.map(() => []));
  for (const item of items)
    tiers[matchTier(item.input.name, query)]![PROVIDER_ORDER.indexOf(item.provider)]!.push(item);
  return tiers.flatMap((queues) => {
    const out: OnlineItem[] = [];
    const longest = Math.max(...queues.map((queue) => queue.length));
    for (let index = 0; index < longest; index += 1)
      for (const queue of queues) if (index < queue.length) out.push(queue[index]!);
    return out;
  });
}

/**
 * PROV-08 no-reshuffle: ranks the new batches among themselves and appends them after `shown`, which is
 * returned unchanged as the prefix. Drops items already shown and cross-provider barcode duplicates
 * (OFF wins within the group; an incoming duplicate of a visible row is dropped).
 */
export function appendOnline(shown: OnlineItem[], batches: OnlineBatch[], query: string): OnlineItem[] {
  const shownKeys = new Set(shown.map(onlineItemKey));
  const shownBarcodes = new Set(shown.map((item) => normalizeBarcode(item.barcode)).filter(Boolean));
  const offBarcodes = new Set(
    batches
      .filter((batch) => batch.provider === 'open_food_facts')
      .flatMap((batch) => batch.items.map((item) => normalizeBarcode(item.barcode)))
      .filter(Boolean),
  );
  const incoming: OnlineItem[] = [];
  for (const batch of batches) {
    for (const item of batch.items) {
      const key = onlineItemKey(item);
      const barcode = normalizeBarcode(item.barcode);
      if (shownKeys.has(key)) continue;
      if (barcode && shownBarcodes.has(barcode)) continue;
      if (barcode && item.provider === 'usda' && offBarcodes.has(barcode)) continue;
      shownKeys.add(key);
      if (barcode) shownBarcodes.add(barcode);
      incoming.push(item);
    }
  }
  return [...shown, ...rankOnline(incoming, query)];
}
