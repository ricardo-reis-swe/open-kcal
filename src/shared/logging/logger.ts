// App logger (ARCH-15). All logging goes through this interface; nothing else may call `console`.
// Callers pass a static message plus a small context of primitive values. Context keys that can carry
// secrets or health data are redacted in every build; release builds keep only allowlisted context keys
// and drop `debug` and error details.

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogValue = string | number | boolean | null | undefined;
export type LogContext = Readonly<Record<string, LogValue>>;

export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, error?: unknown, context?: LogContext): void;
}

export type LogRecord = {
  level: LogLevel;
  message: string;
  context?: Record<string, LogValue>;
  error?: { name: string; message?: string; stack?: string };
};

export type LogSink = (record: LogRecord) => void;

export const REDACTED = '[redacted]';

// Matched case-insensitively against context keys. Covers the USDA key, search terms, diary contents,
// body weights, Quick Calories notes, raw payloads and rows (ARCH-10, ARCH-15).
// `fat(?!al)` so `fatal` stays readable.
const SENSITIVE_KEY =
  /(^q$|api[-_]?key|secret|token|password|authorization|credential|header|query|search|term|note|comment|text|title|label|description|weight|kg|lbs|name|brand|calorie|kcal|energy|protein|carb|fat(?!al)|amount|quantity|serving|value|data|payload|response|body|row|url|email)/i;

// Release builds keep only these operational keys; anything else is redacted, so a new call site can't leak
// diary, weight or search data by picking an unlisted key name (review R1-5). Extend deliberately.
const RELEASE_CONTEXT_KEYS: ReadonlySet<string> = new Set([
  'appVersion',
  'attempt',
  'code',
  'count',
  'durationMs',
  'outcome',
  'platform',
  'pluralRules',
  'provider',
  'retryAfterMs',
  'status',
  'version',
]);

// Strings that look like credentials in URLs or headers, regardless of the key they sit under.
const SENSITIVE_VALUE = /(api[-_]?key=|x-api-key)/i;

export function redactContext(
  context: LogContext | undefined,
  { isDev = true }: { isDev?: boolean } = {},
): Record<string, LogValue> | undefined {
  if (!context) return undefined;
  const out: Record<string, LogValue> = {};
  for (const [key, value] of Object.entries(context)) {
    const sensitive =
      (!isDev && !RELEASE_CONTEXT_KEYS.has(key)) ||
      SENSITIVE_KEY.test(key) ||
      (typeof value === 'string' && SENSITIVE_VALUE.test(value));
    out[key] = sensitive ? REDACTED : value;
  }
  return out;
}

function describeError(error: unknown, includeDetails: boolean): LogRecord['error'] {
  if (error === undefined) return undefined;
  if (error instanceof Error) {
    // Only typed app errors reach here with safe messages (ARCH-13); release builds still keep just the name.
    return includeDetails
      ? { name: error.name, message: redactString(error.message), stack: error.stack && redactString(error.stack) }
      : { name: error.name };
  }
  return { name: typeof error };
}

function redactString(value: string): string {
  return SENSITIVE_VALUE.test(value) ? REDACTED : value;
}

export type LoggerOptions = {
  /** `__DEV__` in the app. Release builds drop debug records and error messages/stacks. */
  isDev: boolean;
  sink: LogSink;
};

export function createLogger({ isDev, sink }: LoggerOptions): Logger {
  const emit = (level: LogLevel, message: string, context?: LogContext, error?: unknown) => {
    if (level === 'debug' && !isDev) return;
    const record: LogRecord = { level, message: redactString(message) };
    const safeContext = redactContext(context, { isDev });
    if (safeContext) record.context = safeContext;
    const safeError = describeError(error, isDev);
    if (safeError) record.error = safeError;
    sink(record);
  };
  return {
    debug: (message, context) => emit('debug', message, context),
    info: (message, context) => emit('info', message, context),
    warn: (message, context) => emit('warn', message, context),
    error: (message, error, context) => emit('error', message, context, error),
  };
}

/* eslint-disable no-console -- the console sink is the logger's only output */
export const consoleSink: LogSink = (record) => {
  const args: unknown[] = [`[${record.level}] ${record.message}`];
  if (record.context) args.push(record.context);
  if (record.error) args.push(record.error);
  const write = { debug: console.debug, info: console.info, warn: console.warn, error: console.error }[record.level];
  write(...args);
};
/* eslint-enable no-console */

export const logger: Logger = createLogger({ isDev: typeof __DEV__ !== 'undefined' && __DEV__, sink: consoleSink });
