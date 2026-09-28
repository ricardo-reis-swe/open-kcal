// OFF transport boundary (PROV-01/03/10/12). It deliberately exposes no URL, query, headers, or body in errors.
import { logProviderFailure, withStatus, type ProviderEndpoint } from '@/data/api/diagnostics';
import type { AppConfig } from '@/shared/config/env';
import { NotFoundError, ProviderResponseError, RateLimitError, TimeoutError } from '@/shared/errors';
import { logger, type Logger } from '@/shared/logging/logger';

import { mapOpenFoodFactsProduct, mapOpenFoodFactsSearch, type FoodCandidate, type FoodSearchPage } from './mapper';
import { RequestLimiter } from './limiter';

type Fetch = typeof fetch;

export class OpenFoodFactsClient {
  private readonly searchLimiter: RequestLimiter;
  private readonly productLimiter: RequestLimiter;

  constructor(
    private readonly config: Pick<
      AppConfig,
      'appVersion' | 'offSearchBaseUrl' | 'offProductBaseUrl' | 'offContactEmail'
    >,
    private readonly request: Fetch = fetch,
    limiters: { search?: RequestLimiter; product?: RequestLimiter } = {},
    private readonly log: Logger = logger,
  ) {
    this.searchLimiter = limiters.search ?? new RequestLimiter(8, 60_000);
    this.productLimiter = limiters.product ?? new RequestLimiter(12, 60_000);
  }

  private headers() {
    return { 'User-Agent': `CalorieTracker/${this.config.appVersion} (${this.config.offContactEmail})` };
  }

  private async throttled<T>(
    limiter: RequestLimiter,
    signal: AbortSignal,
    operation: () => Promise<T>,
    maxWaitMs?: number,
  ): Promise<T> {
    await limiter.take(signal, maxWaitMs);
    try {
      return await operation();
    } catch (error) {
      if (error instanceof RateLimitError) {
        const delay = error.retryAfterMs ?? 60_000;
        this.searchLimiter.cooldown(delay);
        this.productLimiter.cooldown(delay);
      }
      throw error;
    }
  }

  /** PROV-12: one diagnostic record per failure; aborted requests are ignored silently. */
  private async diagnosed<T>(endpoint: ProviderEndpoint, signal: AbortSignal, operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (!signal.aborted) logProviderFailure(error, 'openFoodFacts', endpoint, this.log);
      throw error;
    }
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
    const { status } = response;
    if (status === 429 || status === 503) {
      throw withStatus(
        new RateLimitError('Open Food Facts is rate limited', retryAfter(response.headers.get('Retry-After'))),
        status,
      );
    }
    if (status === 404) throw withStatus(new NotFoundError('Open Food Facts product not found'), status);
    if (!response.ok) throw withStatus(new ProviderResponseError('Open Food Facts response failed'), status);
    try {
      return await response.json();
    } catch (cause) {
      throw new ProviderResponseError('Open Food Facts response is invalid', { cause });
    }
  }

  async search(query: string, page: number, signal: AbortSignal, language = 'en'): Promise<FoodSearchPage> {
    const terms = query.trim().replace(/\s+/g, ' ');
    const url = new URL('/search', this.config.offSearchBaseUrl);
    url.search = new URLSearchParams({
      q: terms,
      langs: `${language.split('-')[0] ?? 'en'},en`,
      page_size: '10',
      page: String(page),
      fields: 'code,product_name,brands,nutriments',
    }).toString();
    return this.diagnosed('search', signal, () =>
      this.throttled(this.searchLimiter, signal, async () =>
        mapOpenFoodFactsSearch(await this.json(url.toString(), signal, 8_000)),
      ),
    );
  }

  getFood(externalId: string, signal: AbortSignal): Promise<FoodCandidate | null> {
    return this.diagnosed('detail', signal, () => this.product(externalId, signal));
  }

  private async product(externalId: string, signal: AbortSignal): Promise<FoodCandidate | null> {
    const url = new URL(`/api/v2/product/${encodeURIComponent(externalId)}`, this.config.offProductBaseUrl);
    url.search = new URLSearchParams({
      fields:
        'code,product_name,brands,quantity,product_quantity,serving_size,serving_quantity,nutrition_data_per,nutriments',
    }).toString();
    // PROV-04: Food Detail may wait briefly for a product-read slot, never for the full one-minute window.
    const payload = await this.throttled(
      this.productLimiter,
      signal,
      () => this.json(url.toString(), signal, 10_000),
      5_000,
    );
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
