import { createLogger, REDACTED, type LogRecord } from '../logger';

function setup(isDev: boolean) {
  const records: LogRecord[] = [];
  const logger = createLogger({ isDev, sink: (record) => records.push(record) });
  return { logger, records };
}

describe('ARCH-15: logger', () => {
  it('emits records with level, message and context', () => {
    const { logger, records } = setup(true);
    logger.info('migration finished', { version: 1, durationMs: 12, outcome: 'ok' });
    expect(records).toEqual([
      { level: 'info', message: 'migration finished', context: { version: 1, durationMs: 12, outcome: 'ok' } },
    ]);
  });

  it('redacts sensitive context keys in every build', () => {
    for (const isDev of [true, false]) {
      const { logger, records } = setup(isDev);
      logger.warn('provider failed', {
        usdaApiKey: 'abc123',
        searchQuery: 'eggs',
        note: 'late snack',
        weightKg: 81.2,
        foodName: 'Scrambled eggs',
        requestUrl: 'https://api.example/foods',
        status: 503,
      });
      expect(records[0]?.context).toEqual({
        usdaApiKey: REDACTED,
        searchQuery: REDACTED,
        note: REDACTED,
        weightKg: REDACTED,
        foodName: REDACTED,
        requestUrl: REDACTED,
        status: 503,
      });
    }
  });

  it('redacts values that look like credentials under any key', () => {
    const { logger, records } = setup(true);
    logger.error('request failed', new Error('GET /foods?api_key=SECRET'), { detail: 'x-api-key: SECRET' });
    expect(records[0]?.context).toEqual({ detail: REDACTED });
    expect(records[0]?.error?.message).toBe(REDACTED);
    expect(JSON.stringify(records)).not.toContain('SECRET');
  });

  it('redacts common diary/weight/search key names too, but not look-alikes such as fatal', () => {
    const { logger, records } = setup(true);
    logger.warn('x', {
      q: 'eggs',
      amount: 2,
      servingSize: 30,
      kg: 80,
      mealTitle: 'Lunch',
      response: '{}',
      fatal: true,
    });
    expect(records[0]?.context).toEqual({
      q: REDACTED,
      amount: REDACTED,
      servingSize: REDACTED,
      kg: REDACTED,
      mealTitle: REDACTED,
      response: REDACTED,
      fatal: true,
    });
  });

  it('keeps only allowlisted context keys in release builds', () => {
    const { logger, records } = setup(false);
    logger.info('app initialized', { appVersion: '0.1.0', durationMs: 5, entryCount: 3, mealId: 'm1' });
    expect(records[0]?.context).toEqual({
      appVersion: '0.1.0',
      durationMs: 5,
      entryCount: REDACTED,
      mealId: REDACTED,
    });
  });

  it('redacts credential-looking messages', () => {
    const { logger, records } = setup(true);
    logger.warn('GET /foods?api_key=SECRET');
    expect(records[0]?.message).toBe(REDACTED);
  });

  it('drops debug records in release builds', () => {
    const { logger, records } = setup(false);
    logger.debug('verbose detail');
    logger.info('kept');
    expect(records.map((r) => r.message)).toEqual(['kept']);
  });

  it('keeps only the error name in release builds', () => {
    const { logger, records } = setup(false);
    class DatabaseError extends Error {
      override name = 'DatabaseError';
    }
    logger.error('save failed', new DatabaseError('constraint failed on diary_entries'));
    expect(records[0]?.error).toEqual({ name: 'DatabaseError' });
  });

  it('describes non-Error throwables by type only', () => {
    const { logger, records } = setup(true);
    logger.error('odd failure', { secret: 'x' });
    expect(records[0]?.error).toEqual({ name: 'object' });
  });
});
