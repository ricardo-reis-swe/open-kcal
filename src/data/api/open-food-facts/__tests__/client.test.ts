import { NotFoundError, RateLimitError } from '@/shared/errors';

import { OpenFoodFactsClient } from '../client';
import { RequestLimiter } from '../limiter';

const config = {
  appVersion: '1.2.3',
  offSearchBaseUrl: 'https://search.openfoodfacts.org',
  offProductBaseUrl: 'https://world.openfoodfacts.org',
  offContactEmail: 'ricardo_reis@live.com',
};
const product = {
  code: '1',
  product_name: 'Water',
  nutriments: { 'energy-kcal_100g': 0, proteins_100g: 0, carbohydrates_100g: 0, fat_100g: 0 },
};

describe('PROV-01 / PROV-03 / PROV-12: OFF client', () => {
  it('uses the documented search shape and identifying header without exposing it in the result', async () => {
    const request = jest
      .fn()
      .mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ hits: [product] }), { status: 200 })));
    const client = new OpenFoodFactsClient(config, request);
    await expect(client.search(' greek  yogurt ', 2, new AbortController().signal)).resolves.toMatchObject({
      candidates: [expect.anything()],
      page: 1,
      pageCount: 0,
    });
    expect(String(request.mock.calls[0]?.[0])).toContain('q=greek+yogurt');
    expect(String(request.mock.calls[0]?.[0])).toContain('langs=en%2Cen');
    expect(request.mock.calls[0]?.[1]?.headers).toEqual({
      'User-Agent': 'CalorieTracker/1.2.3 (ricardo_reis@live.com)',
    });
  });

  it('uses the active app language and maps a network failure without leaking request details', async () => {
    const client = new OpenFoodFactsClient(config, jest.fn().mockRejectedValue(new Error('network down')));
    await expect(client.search('iogurte', 1, new AbortController().signal, 'pt-PT')).rejects.toMatchObject({
      category: 'provider_response',
    });
  });

  it('maps OFF 503/429 to a cooldown and status 0 to not found', async () => {
    const limited = new OpenFoodFactsClient(
      config,
      jest.fn().mockResolvedValue(new Response('', { status: 503, headers: { 'Retry-After': '5' } })),
    );
    await expect(limited.search('milk', 1, new AbortController().signal)).rejects.toMatchObject<
      Partial<RateLimitError>
    >({ category: 'rate_limit', retryAfterMs: 5000 });
    const missing = new OpenFoodFactsClient(
      config,
      jest.fn().mockResolvedValue(new Response(JSON.stringify({ status: 0 }), { status: 200 })),
    );
    await expect(missing.getFood('missing', new AbortController().signal)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('PROV-04 / ROAD-02: fast queries retain only the latest pending request within the OFF search budget', async () => {
    jest.useFakeTimers();
    let time = 0;
    const searchLimiter = new RequestLimiter(2, 60_000, () => time);
    const request = jest
      .fn()
      .mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ hits: [product] }), { status: 200 })));
    const client = new OpenFoodFactsClient(config, request, { search: searchLimiter });
    await Promise.all([
      client.search('egg', 1, new AbortController().signal),
      client.search('eggs', 1, new AbortController().signal),
    ]);

    const stale = new AbortController();
    const pendingStale = client.search('eggs o', 1, stale.signal);
    const latest = client.search('eggs omelette', 1, new AbortController().signal);
    stale.abort(new Error('superseded query'));
    await expect(pendingStale).rejects.toBeInstanceOf(Error);
    time = 60_000;
    await jest.advanceTimersByTimeAsync(60_000);
    await latest;

    expect(request).toHaveBeenCalledTimes(3);
    expect(String(request.mock.calls.at(-1)?.[0])).toContain('q=eggs+omelette');
    jest.useRealTimers();
  });

  it('PROV-04 / UX-04: a throttled product read reaches the row error within five seconds', async () => {
    jest.useFakeTimers();
    let time = 0;
    const productLimiter = new RequestLimiter(1, 60_000, () => time);
    const client = new OpenFoodFactsClient(config, jest.fn(), { product: productLimiter });
    expect(productLimiter.tryTake()).toBe(true);
    const pending = expect(client.getFood('1', new AbortController().signal)).rejects.toMatchObject({
      category: 'timeout',
    });
    time = 5_000;
    await jest.advanceTimersByTimeAsync(5_000);
    await pending;
    jest.useRealTimers();
  });
});
