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

/**
 * PROV-10 transient statuses. USDA's nginx front intermittently answers a valid search with a bare HTML 400
 * (seen 2026-09-30: the same URL alternates 200/400), so for USDA a 400 is transient too.
 */
const TRANSIENT_STATUSES = new Set([400, 500, 502, 503, 504]);
/** PROV-10 retry budgets: search 1 × base 500 ms; detail 2 × 500 ms · 2ⁿ, cap 4 s; full jitter. */
const RETRIES = { search: { max: 1, baseMs: 500 }, detail: { max: 2, baseMs: 500 } } as const;
const BACKOFF_CAP_MS = 4_000;

type Retry = (typeof RETRIES)[keyof typeof RETRIES];

export class UsdaClient {
  constructor(
    private readonly config: Pick<AppConfig, 'usdaBaseUrl'>,
    private readonly credentials: Pick<CredentialsService, 'getUsdaApiKeyForRequest'>,
    private readonly request: Fetch = fetch,
    private readonly log: Logger = logger,
    private readonly random: () => number = Math.random,
  ) {}

  /**
   * PROV-12: one diagnostic record per failure; aborted requests are ignored silently. A missing key is an expected
   * state (no request is sent, the UI shows the key prompt), not a failure: logging it as an error would raise the
   * dev-build error toast over the bottom actions on every search.
   */
  private async diagnosed<T>(endpoint: ProviderEndpoint, signal: AbortSignal, operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      const keyMissing = error instanceof ProviderConfigurationError && error.code === 'usda_key_missing';
      if (!signal.aborted && !keyMissing) logProviderFailure(error, 'usda', endpoint, this.log);
      throw error;
    }
  }

  private async key(): Promise<string> {
    const key = await this.credentials.getUsdaApiKeyForRequest();
    if (!key) throw new ProviderConfigurationError('USDA API key is missing', 'usda_key_missing');
    return key;
  }

  /** PROV-10: retries transient failures within the call's budget; the last failure is the one reported. */
  private async json(
    path: string,
    query: Record<string, string>,
    signal: AbortSignal,
    timeoutMs: number,
    retry: Retry,
  ): Promise<unknown> {
    for (let attempt = 0; ; attempt += 1) {
      const result = await this.attempt(path, query, signal, timeoutMs);
      if (result.ok) return result.value;
      if (!result.transient || attempt >= retry.max || signal.aborted) throw result.error;
      const backoff = this.random() * Math.min(BACKOFF_CAP_MS, retry.baseMs * 2 ** attempt);
      if (!(await wait(backoff, signal))) throw result.error;
    }
  }

  private async attempt(
    path: string,
    query: Record<string, string>,
    signal: AbortSignal,
    timeoutMs: number,
  ): Promise<{ ok: true; value: unknown } | { ok: false; error: Error; transient: boolean }> {
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
      if (controller.signal.aborted && !signal.aborted)
        return { ok: false, error: new TimeoutError('USDA request timed out'), transient: true };
      return { ok: false, error: new ProviderResponseError('USDA request failed'), transient: !signal.aborted };
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
    if (!response.ok)
      return {
        ok: false,
        error: withStatus(new ProviderResponseError('USDA response failed'), status),
        transient: TRANSIENT_STATUSES.has(status),
      };
    try {
      return { ok: true, value: await response.json() };
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
            pageSize: '10',
            pageNumber: String(page),
          },
          signal,
          8_000,
          RETRIES.search,
        ),
      ),
    );
  }

  async getFood(externalId: string, signal: AbortSignal): Promise<FoodCandidate | null> {
    return this.diagnosed('detail', signal, async () =>
      mapUsdaFood(
        await this.json(`food/${encodeURIComponent(externalId)}`, { format: 'full' }, signal, 10_000, RETRIES.detail),
      ),
    );
  }
}

/** Resolves `false` if the caller aborts during the backoff. */
function wait(ms: number, signal: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    const done = (completed: boolean) => {
      clearTimeout(timer);
      signal.removeEventListener('abort', aborted);
      resolve(completed);
    };
    const aborted = () => done(false);
    const timer = setTimeout(() => done(true), ms);
    signal.addEventListener('abort', aborted, { once: true });
  });
}

function retryAfter(value: string | null): number | null {
  if (!value) return 600_000;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : 600_000;
}
