// USDA transport boundary (PROV-01/02/10/12). Credentials are headers only and never enter errors or URLs.
import type { AppConfig } from '@/shared/config/env';
import type { CredentialsService } from '@/data/secure-storage/credentialsService';
import {
  NotFoundError,
  ProviderConfigurationError,
  ProviderResponseError,
  RateLimitError,
  TimeoutError,
} from '@/shared/errors';

import { mapUsdaFood, mapUsdaSearch, type FoodCandidate, type FoodSearchPage } from './mapper';

type Fetch = typeof fetch;

export class UsdaClient {
  constructor(
    private readonly config: Pick<AppConfig, 'usdaBaseUrl'>,
    private readonly credentials: Pick<CredentialsService, 'getUsdaApiKeyForRequest'>,
    private readonly request: Fetch = fetch,
  ) {}

  private async key(): Promise<string> {
    const key = await this.credentials.getUsdaApiKeyForRequest();
    if (!key) throw new ProviderConfigurationError('USDA API key is missing');
    return key;
  }

  private async json(
    path: string,
    query: Record<string, string>,
    signal: AbortSignal,
    timeoutMs: number,
  ): Promise<unknown> {
    const url = new URL(path, this.config.usdaBaseUrl);
    url.search = new URLSearchParams(query).toString();
    const key = await this.key();
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal.addEventListener('abort', abort, { once: true });
    const timeout = setTimeout(abort, timeoutMs);
    let response: Response;
    try {
      response = await this.request(url.toString(), { headers: { 'X-Api-Key': key }, signal: controller.signal });
    } catch (cause) {
      if (signal.aborted) throw cause;
      if (controller.signal.aborted) throw new TimeoutError('USDA request timed out', { cause });
      throw new ProviderResponseError('USDA request failed', { cause });
    } finally {
      clearTimeout(timeout);
      signal.removeEventListener('abort', abort);
    }
    if (response.status === 401 || response.status === 403)
      throw new ProviderConfigurationError('USDA API key was rejected');
    if (response.status === 429)
      throw new RateLimitError('USDA is rate limited', retryAfter(response.headers.get('Retry-After')));
    if (response.status === 404) throw new NotFoundError('USDA food not found');
    if (!response.ok) throw new ProviderResponseError('USDA response failed');
    try {
      return await response.json();
    } catch (cause) {
      throw new ProviderResponseError('USDA response is invalid', { cause });
    }
  }

  async search(query: string, page: number, signal: AbortSignal): Promise<FoodSearchPage> {
    return mapUsdaSearch(
      await this.json(
        '/foods/search',
        {
          query: query.trim().replace(/\s+/g, ' '),
          dataType: 'Foundation,SR Legacy,Survey (FNDDS),Branded',
          pageSize: '20',
          pageNumber: String(page),
        },
        signal,
        8_000,
      ),
    );
  }

  async getFood(externalId: string, signal: AbortSignal): Promise<FoodCandidate | null> {
    return mapUsdaFood(await this.json(`/food/${encodeURIComponent(externalId)}`, { format: 'full' }, signal, 10_000));
  }
}

function retryAfter(value: string | null): number | null {
  if (!value) return 600_000;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : 600_000;
}
