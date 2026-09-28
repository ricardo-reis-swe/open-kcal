// PROV-12 provider failure diagnostics through the app logger (ARCH-15). Dev builds log provider, endpoint,
// status and Zod issue path; release builds log only the error type and provider. Never the URL, query terms,
// headers, key or response body. Details are attached out of band (WeakMap), so the typed error payload stays
// as PROV-12 defines it.
import type { ZodError } from 'zod';

import { ProviderResponseError } from '@/shared/errors';
import { logger as appLogger, type Logger } from '@/shared/logging/logger';

export type ProviderName = 'usda' | 'openFoodFacts';
export type ProviderEndpoint = 'search' | 'detail' | 'keyCheck';

type Details = { status?: number; issuePath?: string };

const details = new WeakMap<object, Details>();

/** Records the HTTP status of a failed response on the error it became. */
export function withStatus<E extends Error>(error: E, status: number): E {
  details.set(error, { ...details.get(error), status });
  return error;
}

/** A whole-response Zod failure: keeps only the first issue's path (schema keys and indexes, never values). */
export function schemaError(message: string, error: ZodError): ProviderResponseError {
  const typed = new ProviderResponseError(message);
  details.set(typed, { issuePath: error.issues[0]?.path.map(String).join('.') ?? '' });
  return typed;
}

/**
 * The error record (type + provider) survives release builds; the details go in a `debug` record, which the
 * logger drops outside dev builds (ARCH-15).
 */
export function logProviderFailure(
  error: unknown,
  provider: ProviderName,
  endpoint: ProviderEndpoint,
  log: Logger = appLogger,
): void {
  const extra = typeof error === 'object' && error !== null ? details.get(error) : undefined;
  log.error('Provider request failed', error, { provider });
  log.debug('Provider failure details', { provider, endpoint, status: extra?.status, issuePath: extra?.issuePath });
}
