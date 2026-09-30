import type { FoodInput } from '@/data/db/repositories/foodsRepository';
import { DEFAULT_FOOD_SEARCH_SECTIONS, type FoodSearchSections } from '@/domain/food/searchSections';
import { ProviderResponseError } from '@/shared/errors';
import { createTestServices } from '@/shared/testing/services';

import { lookupBarcode } from '../barcodeLookup';

const GTIN = '05601009983179';
const input = (name: string): FoodInput => ({
  name,
  brand: null,
  basisQuantity: 100,
  basisUnit: 'g',
  nutrients: { energyKcal: 120, carbohydrateG: 10, proteinG: 5, fatG: 7 },
  servings: [{ label: 'g', quantity: 1, unit: 'g', basisMultiplier: 0.01 }],
});
const signal = () => new AbortController().signal;
const reversed: FoodSearchSections = [...DEFAULT_FOOD_SEARCH_SECTIONS].reverse();
const hide = (...ids: string[]): FoodSearchSections =>
  DEFAULT_FOOD_SEARCH_SECTIONS.map((section) => ({ ...section, visible: !ids.includes(section.id) }));

async function setup({ usdaKey = true } = {}) {
  const { services } = await createTestServices();
  jest.spyOn(services.credentials, 'hasUsdaApiKey').mockResolvedValue(usdaKey);
  const off = jest.spyOn(services.openFoodFacts, 'findBarcode').mockResolvedValue(null);
  const usdaSearch = jest.spyOn(services.usda, 'findBarcode').mockResolvedValue(null);
  const usdaDetail = jest.spyOn(services.usda, 'getFood').mockResolvedValue(null);
  return { services, off, usdaSearch, usdaDetail };
}

describe('PROV-15: barcode lookup', () => {
  it('returns a saved food first, without any request (works offline)', async () => {
    const { services, off, usdaSearch } = await setup();
    const custom = await services.foods.createCustom({ ...input('Iogurte caseiro'), barcode: GTIN });
    const result = await lookupBarcode(services, GTIN, {
      sections: DEFAULT_FOOD_SEARCH_SECTIONS,
      online: false,
      signal: signal(),
    });
    expect(result).toEqual({ kind: 'found', food: expect.objectContaining({ id: custom.id }) });
    expect(off).not.toHaveBeenCalled();
    expect(usdaSearch).not.toHaveBeenCalled();
  });

  it('reads OFF by the GTIN-13 and saves the product with the barcode', async () => {
    const { services, off } = await setup();
    off.mockResolvedValue({ externalId: '5601009983179', input: input('Iogurte grego') });
    const result = await lookupBarcode(services, GTIN, {
      sections: DEFAULT_FOOD_SEARCH_SECTIONS,
      online: true,
      signal: signal(),
    });
    expect(off).toHaveBeenCalledWith('5601009983179', expect.any(AbortSignal));
    expect(result).toMatchObject({ kind: 'found', food: { source: 'open_food_facts', barcode: GTIN } });
    expect((await services.foods.findByBarcode(GTIN))?.name).toBe('Iogurte grego');
  });

  it('asks providers in the DATA-19 order and stops at the first hit', async () => {
    const { services, off, usdaSearch, usdaDetail } = await setup();
    usdaSearch.mockResolvedValue('2035482');
    usdaDetail.mockResolvedValue({ externalId: '2035482', input: input('Greek yogurt') });
    const result = await lookupBarcode(services, GTIN, { sections: reversed, online: true, signal: signal() });
    expect(result).toMatchObject({ kind: 'found', food: { source: 'usda', externalId: '2035482', barcode: GTIN } });
    expect(usdaSearch).toHaveBeenCalledWith(GTIN, expect.any(AbortSignal));
    expect(off).not.toHaveBeenCalled();
  });

  it('falls through OFF to USDA on a miss and reports both as checked when neither has it', async () => {
    const { services, off, usdaSearch } = await setup();
    const result = await lookupBarcode(services, GTIN, {
      sections: DEFAULT_FOOD_SEARCH_SECTIONS,
      online: true,
      signal: signal(),
    });
    expect(off).toHaveBeenCalled();
    expect(usdaSearch).toHaveBeenCalled();
    expect(result).toEqual({
      kind: 'notFound',
      checked: ['open_food_facts', 'usda'],
      failed: [],
      offline: false,
      hidden: [],
    });
  });

  it('sends no request to a hidden provider or to USDA without a key', async () => {
    const hidden = await setup();
    expect(
      await lookupBarcode(hidden.services, GTIN, {
        sections: hide('open_food_facts'),
        online: true,
        signal: signal(),
      }),
    ).toMatchObject({ checked: ['usda'], hidden: ['open_food_facts'] });
    expect(hidden.off).not.toHaveBeenCalled();

    const noKey = await setup({ usdaKey: false });
    expect(
      await lookupBarcode(noKey.services, GTIN, {
        sections: DEFAULT_FOOD_SEARCH_SECTIONS,
        online: true,
        signal: signal(),
      }),
    ).toMatchObject({ checked: ['open_food_facts'], hidden: [] });
    expect(noKey.usdaSearch).not.toHaveBeenCalled();
    expect(noKey.usdaDetail).not.toHaveBeenCalled();
  });

  it('sends nothing remote while offline', async () => {
    const { services, off, usdaSearch } = await setup();
    expect(
      await lookupBarcode(services, GTIN, { sections: DEFAULT_FOOD_SEARCH_SECTIONS, online: false, signal: signal() }),
    ).toEqual({ kind: 'notFound', checked: [], failed: [], offline: true, hidden: [] });
    expect(off).not.toHaveBeenCalled();
    expect(usdaSearch).not.toHaveBeenCalled();
  });

  it('marks a failing provider and still asks the next one', async () => {
    const { services, off, usdaSearch } = await setup();
    off.mockRejectedValue(new ProviderResponseError('OFF failed'));
    const result = await lookupBarcode(services, GTIN, {
      sections: DEFAULT_FOOD_SEARCH_SECTIONS,
      online: true,
      signal: signal(),
    });
    expect(usdaSearch).toHaveBeenCalled();
    expect(result).toMatchObject({
      kind: 'notFound',
      checked: ['open_food_facts', 'usda'],
      failed: ['open_food_facts'],
    });
  });

  it('treats an OFF product that fails PROV-07 as a miss', async () => {
    const { services, off } = await setup({ usdaKey: false });
    off.mockResolvedValue(null);
    expect(
      await lookupBarcode(services, GTIN, { sections: DEFAULT_FOOD_SEARCH_SECTIONS, online: true, signal: signal() }),
    ).toMatchObject({ kind: 'notFound', failed: [] });
  });

  it('rejects once aborted instead of reporting a failure', async () => {
    const { services, off } = await setup();
    const controller = new AbortController();
    off.mockImplementation(async () => {
      controller.abort();
      throw new ProviderResponseError('aborted');
    });
    await expect(
      lookupBarcode(services, GTIN, {
        sections: DEFAULT_FOOD_SEARCH_SECTIONS,
        online: true,
        signal: controller.signal,
      }),
    ).rejects.toThrow();
  });
});
