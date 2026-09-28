import { ProviderConfigurationError, ProviderResponseError, RateLimitError, TimeoutError } from '@/shared/errors';
import { createLogger, type LogRecord } from '@/shared/logging/logger';
import { foodSearchKeys } from '@/features/food-search/food-search.queries';

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
      '/fdc/v1/foods/search?query=egg&dataType=Foundation%2CSR+Legacy%2CSurvey+%28FNDDS%29%2CBranded&pageSize=10&pageNumber=2',
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
    await expect(missing.search('secret term', 1, new AbortController().signal)).rejects.toMatchObject({
      category: 'provider_configuration',
      code: 'usda_key_missing',
    });
    expect(request).toHaveBeenCalledTimes(1);
    const rejected = new UsdaClient(
      config,
      credentials,
      jest.fn().mockResolvedValue(new Response('', { status: 401 })),
    );
    await expect(rejected.search('secret term', 1, new AbortController().signal)).rejects.toMatchObject({
      category: 'provider_configuration',
      code: 'usda_key_rejected',
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

  it('ARCH-10 / ARCH-13 / ARCH-15 / ROAD-02: redacts credential-bearing transport failures from errors, logs and query keys', async () => {
    const credential = 'usda-key-for-redaction-test';
    const privateTerm = 'private USDA search term';
    const unsafeTransportError = Object.assign(
      new Error(`GET https://api.nal.usda.gov/fdc/v1/foods/search?query=${privateTerm}`),
      {
        headers: { 'X-Api-Key': credential },
        responseBody: `{\"api_key\":\"${credential}\"}`,
        cause: new Error(`X-Api-Key: ${credential}`),
      },
    );
    const request = jest.fn().mockRejectedValue(unsafeTransportError);
    const diagnostics: LogRecord[] = [];
    const client = new UsdaClient(
      config,
      { getUsdaApiKeyForRequest: jest.fn().mockResolvedValue(credential) },
      request,
      createLogger({ isDev: true, sink: (record) => diagnostics.push(record) }),
    );

    let received: unknown;
    try {
      await client.search(privateTerm, 1, new AbortController().signal);
    } catch (error) {
      received = error;
    }

    expect(received).toBeInstanceOf(ProviderResponseError);
    expect(allOwnPropertyValues(received)).not.toContain(credential);
    expect(allOwnPropertyValues(received)).not.toContain(privateTerm);
    expect(Object.getOwnPropertyNames(received as object)).not.toContain('cause');

    const records: LogRecord[] = [];
    createLogger({ isDev: true, sink: (record) => records.push(record) }).error('USDA request failed', received);
    expect(allOwnPropertyValues(records)).not.toContain(credential);
    expect(allOwnPropertyValues(records)).not.toContain(privateTerm);

    // PROV-12: the adapter's own dev diagnostic carries provider + endpoint, never key, terms or URL.
    expect(diagnostics.map((record) => record.context)).toEqual([
      { provider: 'usda' },
      { provider: 'usda', endpoint: 'search', status: undefined, issuePath: undefined },
    ]);
    expect(allOwnPropertyValues(diagnostics)).not.toContain(credential);
    expect(allOwnPropertyValues(diagnostics)).not.toContain(privateTerm);
    expect(allOwnPropertyValues(diagnostics)).not.toContain('api.nal.usda.gov');

    expect(foodSearchKeys.usda(privateTerm, 1)).not.toContain(credential);
    expect(foodSearchKeys.usda(privateTerm, 1)).toEqual(['foodSearch', 'usda', privateTerm, 1]);
  });

  it('PROV-12: a missing key sends no request and logs nothing (expected state, not a failure)', async () => {
    const request = jest.fn();
    const records: LogRecord[] = [];
    const client = new UsdaClient(
      config,
      { getUsdaApiKeyForRequest: jest.fn().mockResolvedValue(null) },
      request,
      createLogger({ isDev: true, sink: (record) => records.push(record) }),
    );
    await expect(client.search('egg', 1, new AbortController().signal)).rejects.toBeInstanceOf(
      ProviderConfigurationError,
    );
    expect(request).not.toHaveBeenCalled();
    expect(records).toEqual([]);
  });

  it('PROV-12 / ARCH-15: dev logs provider, endpoint, status and Zod issue path; release only type + provider', async () => {
    const credential = 'usda-key-for-diagnostics-test';
    const privateTerm = 'private diagnostics term';
    const keyed = { getUsdaApiKeyForRequest: jest.fn().mockResolvedValue(credential) };
    const dev: LogRecord[] = [];
    const devLog = createLogger({ isDev: true, sink: (record) => dev.push(record) });
    const failing = jest.fn().mockResolvedValue(new Response(`{"echo":"${privateTerm}"}`, { status: 500 }));
    await expect(
      new UsdaClient(config, keyed, failing, devLog).search(privateTerm, 1, new AbortController().signal),
    ).rejects.toBeInstanceOf(ProviderResponseError);
    const malformed = jest
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ description: privateTerm, foodNutrients: 'x' })));
    await expect(
      new UsdaClient(config, keyed, malformed, devLog).getFood('1', new AbortController().signal),
    ).rejects.toBeInstanceOf(ProviderResponseError);
    expect(dev.filter((record) => record.level === 'debug').map((record) => record.context)).toEqual([
      { provider: 'usda', endpoint: 'search', status: 500, issuePath: undefined },
      { provider: 'usda', endpoint: 'detail', status: undefined, issuePath: 'fdcId' },
    ]);
    expect(allOwnPropertyValues(dev)).not.toContain(credential);
    expect(allOwnPropertyValues(dev)).not.toContain(privateTerm);

    const release: LogRecord[] = [];
    const releaseLog = createLogger({ isDev: false, sink: (record) => release.push(record) });
    const logged = new UsdaClient(config, keyed, failing, releaseLog);
    await expect(logged.search(privateTerm, 1, new AbortController().signal)).rejects.toBeDefined();
    expect(release).toEqual([
      {
        level: 'error',
        message: 'Provider request failed',
        context: { provider: 'usda' },
        error: { name: 'ProviderResponseError' },
      },
    ]);
  });

  it('ARCH-13 / PROV-12: keeps timeout and malformed JSON errors typed without transport causes', async () => {
    jest.useFakeTimers();
    const pendingRequest = jest.fn().mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise<never>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new Error('credentialed transport abort')), {
            once: true,
          });
        }),
    );
    const client = new UsdaClient(config, credentials, pendingRequest);
    const timedOut = client.search('egg', 1, new AbortController().signal);
    const timeoutExpectation = expect(timedOut).rejects.toBeInstanceOf(TimeoutError);
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(8_000);
    await timeoutExpectation;
    jest.useRealTimers();

    const invalidJson = new UsdaClient(
      config,
      credentials,
      jest.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.reject(new Error('body with key')) }),
    );
    await expect(invalidJson.search('egg', 1, new AbortController().signal)).rejects.toMatchObject({
      category: 'provider_response',
    });
  });
});

function allOwnPropertyValues(value: unknown, seen = new Set<unknown>()): string {
  if (value === null || value === undefined || seen.has(value)) return '';
  if (typeof value === 'string') return value;
  if (typeof value !== 'object' && typeof value !== 'function') return String(value);
  seen.add(value);
  return Reflect.ownKeys(value)
    .map((key) => {
      try {
        return allOwnPropertyValues(Reflect.get(value, key), seen);
      } catch {
        return '';
      }
    })
    .join(' ');
}
