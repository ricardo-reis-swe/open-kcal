// Typed application errors (ARCH-13). Infrastructure maps its failures to these before feature code sees them;
// callers branch on `category`, never on message text. Messages are for developers and must stay free of SQL
// values, credentials, payloads and diary content (ARCH-15).

export type ErrorCategory =
  | 'validation'
  | 'not_found'
  | 'conflict'
  | 'database'
  | 'migration'
  | 'secure_storage'
  | 'offline'
  | 'timeout'
  | 'rate_limit'
  | 'provider_configuration'
  | 'provider_response'
  | 'unexpected';

export abstract class AppError extends Error {
  abstract readonly category: ErrorCategory;

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {
  readonly category = 'validation';
  /** Field paths that failed, e.g. `['energyKcal']`. Never the offending values. */
  readonly fields: readonly string[];

  constructor(message: string, fields: readonly string[] = [], options?: { cause?: unknown }) {
    super(message, options);
    this.fields = fields;
  }
}

export class NotFoundError extends AppError {
  readonly category = 'not_found';
}

export class ConflictError extends AppError {
  readonly category = 'conflict';
}

export class DatabaseError extends AppError {
  readonly category = 'database';
}

export class MigrationError extends AppError {
  readonly category = 'migration';
  readonly version: number;

  constructor(message: string, version: number, options?: { cause?: unknown }) {
    super(message, options);
    this.version = version;
  }
}

export class SecureStorageError extends AppError {
  readonly category = 'secure_storage';
}

export class OfflineError extends AppError {
  readonly category = 'offline';
}

export class TimeoutError extends AppError {
  readonly category = 'timeout';
}

export class RateLimitError extends AppError {
  readonly category = 'rate_limit';
  /** Server guidance, when given (ARCH-11: never auto-retry a 429 without it). */
  readonly retryAfterMs: number | null;

  constructor(message: string, retryAfterMs: number | null = null, options?: { cause?: unknown }) {
    super(message, options);
    this.retryAfterMs = retryAfterMs;
  }
}

export class ProviderConfigurationError extends AppError {
  readonly category = 'provider_configuration';
}

export class ProviderResponseError extends AppError {
  readonly category = 'provider_response';
}

export class UnexpectedError extends AppError {
  readonly category = 'unexpected';
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/** Wraps anything that isn't already typed, keeping the original as `cause` for dev diagnostics. */
export function toAppError(error: unknown, fallback: (cause: unknown) => AppError = defaultFallback): AppError {
  return isAppError(error) ? error : fallback(error);
}

function defaultFallback(cause: unknown): AppError {
  return new UnexpectedError('Unexpected error', { cause });
}
