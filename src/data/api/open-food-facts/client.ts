// OFF transport boundary (PROV-01/03/10/12). It deliberately exposes no URL, query, headers, or body in errors.
import type { AppConfig } from '@/shared/config/env';
import { NotFoundError, ProviderResponseError, RateLimitError, TimeoutError } from '@/shared/errors';

import { mapOpenFoodFactsProduct, mapOpenFoodFactsSearch, type FoodCandidate } from './mapper';

type Fetch = typeof fetch;

export class OpenFoodFactsClient {
  constructor(
    private readonly config: Pick<
      AppConfig,
      'appVersion' | 'offSearchBaseUrl' | 'offProductBaseUrl' | 'offContactEmail'
    >,
    private readonly request: Fetch = fetch,
  ) {}

  private headers() {
    return { 'User-Agent': `CalorieTracker/${this.config.appVersion} (${this.config.offContactEmail})` };
  }

  private async json(url: string, signal: AbortSignal, timeoutMs: number): Promise<unknown> {
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal.addEventListener('abort', abort, { once: true });
    const timeout = setTimeout(abort, timeoutMs);
    let response: Response;
    try {
      response = await this.request(url, { headers: this.headers(), signal: controller.signal });
    } catch (cause) {
      if (signal.aborted) throw cause;
      if (controller.signal.aborted) throw new TimeoutError('Open Food Facts request timed out', { cause });
      throw new ProviderResponseError('Open Food Facts request failed', { cause });
    } finally {
      clearTimeout(timeout);
      signal.removeEventListener('abort', abort);
    }
    if (response.status === 429 || response.status === 503) {
      throw new RateLimitError('Open Food Facts is rate limited', retryAfter(response.headers.get('Retry-After')));
    }
    if (response.status === 404) throw new NotFoundError('Open Food Facts product not found');
    if (!response.ok) throw new ProviderResponseError('Open Food Facts response failed');
    try {
      return await response.json();
    } catch (cause) {
      throw new ProviderResponseError('Open Food Facts response is invalid', { cause });
    }
  }

  async search(query: string, page: number, signal: AbortSignal, language = 'en'): Promise<FoodCandidate[]> {
    const terms = query.trim().replace(/\s+/g, ' ');
    const url = new URL('/search', this.config.offSearchBaseUrl);
    url.search = new URLSearchParams({
      q: terms,
      langs: `${language.split('-')[0] ?? 'en'},en`,
      page_size: '20',
      page: String(page),
      fields: 'code,product_name,brands,nutriments',
    }).toString();
    return mapOpenFoodFactsSearch(await this.json(url.toString(), signal, 8_000));
  }

  async getFood(externalId: string, signal: AbortSignal): Promise<FoodCandidate | null> {
    const url = new URL(`/api/v2/product/${encodeURIComponent(externalId)}`, this.config.offProductBaseUrl);
    url.search = new URLSearchParams({
      fields:
        'code,product_name,brands,quantity,product_quantity,serving_size,serving_quantity,nutrition_data_per,nutriments',
    }).toString();
    const payload = await this.json(url.toString(), signal, 10_000);
    const status =
      typeof payload === 'object' && payload !== null ? (payload as { status?: unknown }).status : undefined;
    if (status === 0) throw new NotFoundError('Open Food Facts product not found');
    const product =
      typeof payload === 'object' && payload !== null ? (payload as { product?: unknown }).product : undefined;
    return mapOpenFoodFactsProduct(product);
  }
}

function retryAfter(value: string | null): number | null {
  if (!value) return 60_000;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : 60_000;
}
