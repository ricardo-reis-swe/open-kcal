// USDA transport boundary (PROV-01/02/10/12). Credentials are headers only and never enter errors or URLs.
import { logProviderFailure, withStatus, type ProviderEndpoint } from '@/data/api/diagnostics';
import type { AppConfig } from '@/shared/config/env';
import type { CredentialsService } from '@/data/secure-storage/credentialsService';
import {
  NotFoundError,
  ProviderConfigurationError,
  ProviderResponseError,
  RateLimitError,
  TimeoutError,
} from '@/shared/errors';
import { logger, type Logger } from '@/shared/logging/logger';

import { mapUsdaFood, mapUsdaSearch, type FoodCandidate, type FoodSearchPage } from './mapper';

type Fetch = typeof fetch;

export class UsdaClient {
  constructor(
    private readonly config: Pick<AppConfig, 'usdaBaseUrl'>,
    private readonly credentials: Pick<CredentialsService, 'getUsdaApiKeyForRequest'>,
    private readonly request: Fetch = fetch,
    private readonly log: Logger = logger,
  ) {}

  /** PROV-12: one diagnostic record per failure; aborted requests are ignored silently. */
  private async diagnosed<T>(endpoint: ProviderEndpoint, signal: AbortSignal, operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (!signal.aborted) logProviderFailure(error, 'usda', endpoint, this.log);
      throw error;
    }
  }

  private async key(): Promise<string> {
    const key = await this.credentials.getUsdaApiKeyForRequest();
    if (!key) throw new ProviderConfigurationError('USDA API key is missing', 'usda_key_missing');
    return key;
  }

  private async json(
    path: string,
    query: Record<string, string>,
    signal: AbortSignal,
    timeoutMs: number,
  ): Promise<unknown> {
    // PROV-01: preserve the configured `/fdc/v1` path; a leading URL path would discard it.
    const url = new URL(path, `${this.config.usdaBaseUrl.replace(/\/$/, '')}/`);
    url.search = new URLSearchParams(query).toString();
    const key = await this.key();
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal.addEventListener('abort', abort, { once: true });
    const timeout = setTimeout(abort, timeoutMs);
    let response: Response;
    try {
      response = await this.request(url.toString(), { headers: { 'X-Api-Key': key }, signal: controller.signal });
    } catch {
      // ARCH-13/15 + PROV-12: native transport errors can retain the request URL,
      // headers, response body, or key in non-enumerable properties such as `cause`.
      // Map them to static typed errors before they cross this provider boundary.
      if (controller.signal.aborted && !signal.aborted) throw new TimeoutError('USDA request timed out');
      throw new ProviderResponseError('USDA request failed');
    } finally {
      clearTimeout(timeout);
      signal.removeEventListener('abort', abort);
    }
    const { status } = response;
    if (status === 401 || status === 403)
      throw withStatus(new ProviderConfigurationError('USDA API key was rejected', 'usda_key_rejected'), status);
    if (status === 429)
      throw withStatus(
        new RateLimitError('USDA is rate limited', retryAfter(response.headers.get('Retry-After'))),
        status,
      );
    if (status === 404) throw withStatus(new NotFoundError('USDA food not found'), status);
    if (!response.ok) throw withStatus(new ProviderResponseError('USDA response failed'), status);
    try {
      return await response.json();
    } catch {
      // A JSON parser error may retain a response body, so it must not become an AppError cause.
      throw new ProviderResponseError('USDA response is invalid');
    }
  }

  async search(query: string, page: number, signal: AbortSignal): Promise<FoodSearchPage> {
    return this.diagnosed('search', signal, async () =>
      mapUsdaSearch(
        await this.json(
          'foods/search',
          {
            query: query.trim().replace(/\s+/g, ' '),
            dataType: 'Foundation,SR Legacy,Survey (FNDDS),Branded',
            pageSize: '20',
            pageNumber: String(page),
          },
          signal,
          8_000,
        ),
      ),
    );
  }

  async getFood(externalId: string, signal: AbortSignal): Promise<FoodCandidate | null> {
    return this.diagnosed('detail', signal, async () =>
      mapUsdaFood(await this.json(`food/${encodeURIComponent(externalId)}`, { format: 'full' }, signal, 10_000)),
    );
  }
}

function retryAfter(value: string | null): number | null {
  if (!value) return 600_000;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : 600_000;
}
