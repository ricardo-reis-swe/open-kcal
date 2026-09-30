import captured from '../__fixtures__/captured/search-barcode-031200037206.json';
import mismatch from '../__fixtures__/synthetic-search-barcode-mismatch.json';
import { UsdaClient } from '../client';
import { mapUsdaBarcodeSearch } from '../mapper';

const GTIN = '00031200037206';

describe('PROV-15: USDA barcode lookup', () => {
  it('maps a captured barcode search to the fdcId whose gtinUpc matches', () => {
    expect(mapUsdaBarcodeSearch(captured, GTIN)).toBe('2035482');
  });

  it('ignores text-only matches and unparseable hits; any gtinUpc length of the same GTIN matches', () => {
    expect(mapUsdaBarcodeSearch(mismatch, GTIN)).toBe('113');
    expect(mapUsdaBarcodeSearch({ foods: [] }, GTIN)).toBeNull();
    expect(() => mapUsdaBarcodeSearch({ nope: true }, GTIN)).toThrow();
  });

  it('searches Branded foods by the 12-digit UPC-A with the key in a header only', async () => {
    const request = jest.fn().mockResolvedValue(new Response(JSON.stringify(captured)));
    const client = new UsdaClient(
      { usdaBaseUrl: 'https://api.nal.usda.gov/fdc/v1' },
      { getUsdaApiKeyForRequest: async () => 'test-usda-key' },
      request,
    );
    await expect(client.findBarcode(GTIN, new AbortController().signal)).resolves.toBe('2035482');
    const [url, init] = request.mock.calls[0]!;
    const parsed = new URL(url as string);
    expect(parsed.pathname).toBe('/fdc/v1/foods/search');
    expect(Object.fromEntries(parsed.searchParams)).toEqual({
      query: '031200037206',
      dataType: 'Branded',
      pageSize: '10',
    });
    expect(url).not.toContain('test-usda-key');
    expect(init.headers).toEqual({ 'X-Api-Key': 'test-usda-key' });
  });
});
