import { NotFoundError, RateLimitError } from '@/shared/errors';

import { OpenFoodFactsClient } from '../client';

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
    const request = jest.fn().mockResolvedValue(new Response(JSON.stringify({ hits: [product] }), { status: 200 }));
    const client = new OpenFoodFactsClient(config, request);
    await expect(client.search(' greek  yogurt ', 2, new AbortController().signal)).resolves.toHaveLength(1);
    expect(String(request.mock.calls[0]?.[0])).toContain('q=greek+yogurt');
    expect(request.mock.calls[0]?.[1]?.headers).toEqual({
      'User-Agent': 'CalorieTracker/1.2.3 (ricardo_reis@live.com)',
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
});
