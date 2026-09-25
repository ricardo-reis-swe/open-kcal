import {
  AppError,
  ConflictError,
  DatabaseError,
  MigrationError,
  NotFoundError,
  OfflineError,
  ProviderConfigurationError,
  ProviderResponseError,
  RateLimitError,
  SecureStorageError,
  TimeoutError,
  UnexpectedError,
  ValidationError,
  isAppError,
  toAppError,
} from '..';

describe('ARCH-13: typed errors', () => {
  it.each([
    [new ValidationError('x', ['energyKcal']), 'validation', 'ValidationError'],
    [new NotFoundError('x'), 'not_found', 'NotFoundError'],
    [new ConflictError('x'), 'conflict', 'ConflictError'],
    [new DatabaseError('x'), 'database', 'DatabaseError'],
    [new MigrationError('x', 1), 'migration', 'MigrationError'],
    [new SecureStorageError('x'), 'secure_storage', 'SecureStorageError'],
    [new OfflineError('x'), 'offline', 'OfflineError'],
    [new TimeoutError('x'), 'timeout', 'TimeoutError'],
    [new RateLimitError('x', 3000), 'rate_limit', 'RateLimitError'],
    [new ProviderConfigurationError('x'), 'provider_configuration', 'ProviderConfigurationError'],
    [new ProviderResponseError('x'), 'provider_response', 'ProviderResponseError'],
    [new UnexpectedError('x'), 'unexpected', 'UnexpectedError'],
  ] as const)('%s has a stable category and name', (error, category, name) => {
    expect(error).toBeInstanceOf(AppError);
    expect(error).toBeInstanceOf(Error);
    expect(error.category).toBe(category);
    expect(error.name).toBe(name);
  });

  it('keeps structured details instead of values in messages', () => {
    expect(new ValidationError('Invalid entry', ['energyKcal']).fields).toEqual(['energyKcal']);
    expect(new MigrationError('Migration failed', 3).version).toBe(3);
    expect(new RateLimitError('Too many requests').retryAfterMs).toBeNull();
  });

  it('wraps untyped errors as UnexpectedError with the original as cause', () => {
    const raw = new Error('SQLITE_CONSTRAINT: something');
    const wrapped = toAppError(raw);
    expect(wrapped).toBeInstanceOf(UnexpectedError);
    expect(wrapped.cause).toBe(raw);
    expect(wrapped.message).not.toContain('SQLITE');
    const typed = new NotFoundError('Meal not found');
    expect(toAppError(typed)).toBe(typed);
    expect(isAppError(raw)).toBe(false);
    expect(toAppError('boom', (cause) => new DatabaseError('Database error', { cause }))).toBeInstanceOf(DatabaseError);
  });
});
