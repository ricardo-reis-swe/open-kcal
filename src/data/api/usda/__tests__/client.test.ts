import { ProviderConfigurationError, RateLimitError } from '@/shared/errors';

import { UsdaClient } from '../client';

const config = { usdaBaseUrl: 'https://api.nal.usda.gov/fdc/v1' };
const credentials = { getUsdaApiKeyForRequest: jest.fn().mockResolvedValue('test-usda-key') };
const food = {
  fdcId: 1,
  description: 'Water',
  foodNutrients: [
    { nutrientNumber: '208', unitName: 'KCAL', value: 0 },
    { nutrientNumber: '203', unitName: 'G', value: 0 },
  ],
};

describe('PROV-01 / PROV-02 / PROV-12: USDA client', () => {
  beforeEach(() => credentials.getUsdaApiKeyForRequest.mockClear());

  it('uses documented endpoint shapes and sends the API key only in a header', async () => {
    const request = jest
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ foods: [food], currentPage: 1, totalPages: 1 })));
    const client = new UsdaClient(config, credentials, request);
    await client.search('  egg  ', 2, new AbortController().signal);
    const [url, init] = request.mock.calls[0]!;
    expect(String(url)).toContain(
      '/fdc/v1/foods/search?query=egg&dataType=Foundation%2CSR+Legacy%2CSurvey+%28FNDDS%29%2CBranded&pageSize=20&pageNumber=2',
    );
    expect(String(url)).not.toContain('api_key');
    expect(init.headers).toEqual({ 'X-Api-Key': 'test-usda-key' });
  });

  it('uses the full detail endpoint and maps missing/rejected keys without exposing credentials', async () => {
    const request = jest
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ ...food, foodNutrients: [{ nutrient: { number: '208', unitName: 'kcal' }, amount: 0 }] }),
        ),
      );
    await new UsdaClient(config, credentials, request).getFood('1/2', new AbortController().signal);
    expect(String(request.mock.calls[0]?.[0])).toContain('/fdc/v1/food/1%2F2?format=full');
    const missing = new UsdaClient(config, { getUsdaApiKeyForRequest: jest.fn().mockResolvedValue(null) }, request);
    await expect(missing.search('secret term', 1, new AbortController().signal)).rejects.toBeInstanceOf(
      ProviderConfigurationError,
    );
    expect(request).toHaveBeenCalledTimes(1);
    const rejected = new UsdaClient(
      config,
      credentials,
      jest.fn().mockResolvedValue(new Response('', { status: 401 })),
    );
    await expect(rejected.search('secret term', 1, new AbortController().signal)).rejects.toMatchObject({
      category: 'provider_configuration',
    });
  });

  it('maps 429 to the USDA cooldown without leaking URL, terms, headers or key in the error', async () => {
    const client = new UsdaClient(
      config,
      credentials,
      jest.fn().mockResolvedValue(new Response('', { status: 429, headers: { 'Retry-After': '5' } })),
    );
    await expect(client.search('private search', 1, new AbortController().signal)).rejects.toMatchObject<
      Partial<RateLimitError>
    >({ category: 'rate_limit', retryAfterMs: 5000 });
    try {
      await client.search('private search', 1, new AbortController().signal);
    } catch (error) {
      expect(String(error)).not.toContain('test-usda-key');
      expect(String(error)).not.toContain('private search');
      expect(String(error)).not.toContain('api.nal.usda.gov');
    }
  });
});
