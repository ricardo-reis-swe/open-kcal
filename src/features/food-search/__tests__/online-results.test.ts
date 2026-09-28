import type { FoodInput } from '@/data/db/repositories/foodsRepository';

import {
  appendOnline,
  matchTier,
  normalizeBarcode,
  rankOnline,
  type OnlineItem,
  type OnlineProvider,
} from '../online-results';

const input = (name: string): FoodInput => ({
  name,
  brand: null,
  basisQuantity: 100,
  basisUnit: 'g',
  nutrients: { energyKcal: 100, carbohydrateG: 1, proteinG: 1, fatG: 1 },
  servings: [],
});
const item = (provider: OnlineProvider, externalId: string, name: string, barcode?: string): OnlineItem => ({
  provider,
  externalId,
  input: input(name),
  barcode,
});
const ids = (items: OnlineItem[]) => items.map((entry) => entry.externalId);

describe('PROV-08: merged Online list', () => {
  it('ranks by the local name tiers, case-insensitive with diacritics as typed', () => {
    expect(matchTier('Chicken breast', 'chicken breast')).toBe(0);
    expect(matchTier('Chicken breast fillets', 'Chicken  breast')).toBe(1);
    expect(matchTier('Chicken, breast, raw', 'chicken breast')).toBe(2);
    expect(matchTier('Roast chicken with breastbone', 'chick breast')).toBe(2);
    expect(matchTier('Soup (chicken)', 'hicken')).toBe(3);
    expect(matchTier('Pão de forma', 'pao')).toBe(3);
  });

  it('interleaves providers round-robin within a tier, USDA first, each keeping its own order', () => {
    const ranked = rankOnline(
      [
        item('usda', 'u-generic', 'Egg, whole, raw'),
        item('usda', 'u-branded', 'Egg whites liquid'),
        item('usda', 'u-other', 'Omelette with egg'),
        item('open_food_facts', 'o-1', 'Egg noodles'),
        item('open_food_facts', 'o-2', 'Egg'),
        item('open_food_facts', 'o-3', 'Eggs free range'),
      ],
      'egg',
    );
    // tier 0: o-2 · tier 1: u-generic, o-1, u-branded, o-3 (USDA generic promotion preserved) · tier 2: u-other
    expect(ids(ranked)).toEqual(['o-2', 'u-generic', 'o-1', 'u-branded', 'o-3', 'u-other']);
  });

  it('dedupes by barcode across providers (digits, leading zeros) and keeps the OFF item', () => {
    expect(normalizeBarcode('00-0123 456')).toBe('123456');
    expect(normalizeBarcode('000')).toBeNull();
    const merged = appendOnline(
      [],
      [
        { provider: 'usda', items: [item('usda', 'u-1', 'Oat bar', '000123456'), item('usda', 'u-2', 'Oat bar mini')] },
        { provider: 'open_food_facts', items: [item('open_food_facts', '123456', 'Oat bar', '123456')] },
      ],
      'oat bar',
    );
    expect(ids(merged)).toEqual(['123456', 'u-2']);
  });

  it('appends late or Show more items after the visible rows without reordering them', () => {
    const shown = appendOnline(
      [],
      [{ provider: 'usda', items: [item('usda', 'u-1', 'Rice, white'), item('usda', 'u-2', 'Rice cakes', '42')] }],
      'rice',
    );
    const late = appendOnline(
      shown,
      [
        {
          provider: 'open_food_facts',
          items: [
            item('open_food_facts', 'o-other', 'Brown basmati'),
            item('open_food_facts', 'o-exact', 'Rice'),
            item('open_food_facts', '42', 'Rice cakes', '42'),
          ],
        },
      ],
      'rice',
    );
    expect(late.slice(0, 2)).toEqual(shown);
    // new items ranked among themselves; the OFF duplicate of a visible USDA row is dropped
    expect(ids(late)).toEqual(['u-1', 'u-2', 'o-exact', 'o-other']);
    const more = appendOnline(
      late,
      [
        { provider: 'usda', items: [item('usda', 'u-1', 'Rice, white'), item('usda', 'u-3', 'Rice flour')] },
        { provider: 'open_food_facts', items: [item('open_food_facts', 'o-rice', 'Rice')] },
      ],
      'rice',
    );
    expect(ids(more)).toEqual(['u-1', 'u-2', 'o-exact', 'o-other', 'o-rice', 'u-3']);
  });
});
