// PROV-15 barcode lookup: saved foods, then the visible and available remote providers in the DATA-19 order.
import type { AppServices } from '@/bootstrap/services';
import type { FoodCandidate } from '@/data/api/open-food-facts/mapper';
import type { Food } from '@/data/db/repositories/foodsRepository';
import { displayBarcode, type Gtin14 } from '@/domain/food/barcode';
import {
  REMOTE_FOOD_SEARCH_SECTIONS,
  visibleFoodSearchSections,
  type FoodSearchSections,
} from '@/domain/food/searchSections';
import { NotFoundError } from '@/shared/errors';

import { refreshSavedFood, saveExternalCandidate } from './food-search.queries';

export type BarcodeProvider = 'open_food_facts' | 'usda';

export type BarcodeLookupResult =
  | { kind: 'found'; food: Food }
  | {
      kind: 'notFound';
      /** Remote providers that were asked, in order (saved foods are always checked). */
      checked: BarcodeProvider[];
      /** Asked but errored (PROV-12); the UX-24 `Retry` state. */
      failed: BarcodeProvider[];
      /** No remote request because the device is offline. */
      offline: boolean;
      /** Remote providers hidden in UX-18 `Search results`. */
      hidden: BarcodeProvider[];
    };

/** One lookup per scan (PROV-15). An aborted lookup rejects; the screen ignores it. */
export async function lookupBarcode(
  services: AppServices,
  gtin: Gtin14,
  { sections, online, signal }: { sections: FoodSearchSections; online: boolean; signal: AbortSignal },
): Promise<BarcodeLookupResult> {
  const saved = await services.foods.findByBarcode(gtin);
  if (saved) {
    // PROV-09: a saved external food opens as is; an expired one refreshes in the background for next time.
    void refreshSavedFood(services, saved);
    return { kind: 'found', food: saved };
  }
  const visible = visibleFoodSearchSections(sections);
  const remote = visible.filter((id): id is BarcodeProvider => REMOTE_FOOD_SEARCH_SECTIONS.includes(id));
  const hidden = (REMOTE_FOOD_SEARCH_SECTIONS as readonly BarcodeProvider[]).filter((id) => !remote.includes(id));
  const checked: BarcodeProvider[] = [];
  const failed: BarcodeProvider[] = [];
  if (!online) return { kind: 'notFound', checked, failed, offline: true, hidden };

  for (const provider of remote) {
    // PROV-15: USDA without a key is unavailable, so it gets no request (and isn't listed as checked).
    if (provider === 'usda' && !(await services.credentials.hasUsdaApiKey())) continue;
    if (signal.aborted) throw new Error('Barcode lookup aborted');
    checked.push(provider);
    try {
      const candidate = await readCandidate(services, provider, gtin, signal);
      if (!candidate) continue;
      // The provider matched this code, so the saved food carries it even if its detail lacks one (DATA-24).
      const food = await saveExternalCandidate(services, provider, {
        ...candidate,
        input: { ...candidate.input, barcode: candidate.input.barcode ?? gtin },
      });
      return { kind: 'found', food };
    } catch (error) {
      if (signal.aborted) throw error;
      failed.push(provider);
    }
  }
  return { kind: 'notFound', checked, failed, offline: false, hidden };
}

async function readCandidate(
  services: AppServices,
  provider: BarcodeProvider,
  gtin: Gtin14,
  signal: AbortSignal,
): Promise<FoodCandidate | null> {
  try {
    if (provider === 'open_food_facts') return await services.openFoodFacts.getFood(displayBarcode(gtin), signal);
    const fdcId = await services.usda.findBarcode(gtin, signal);
    return fdcId ? await services.usda.getFood(fdcId, signal) : null;
  } catch (error) {
    // Not found is a miss, not a failure (PROV-12 detail 404 / OFF `status: 0`).
    if (error instanceof NotFoundError) return null;
    throw error;
  }
}
