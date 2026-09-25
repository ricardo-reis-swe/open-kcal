// App logger (ARCH-15). All logging goes through this interface; nothing else may call `console`.
// Callers pass a static message plus a small context of primitive values. Context keys that can carry
// secrets or health data are redacted in every build; release builds also drop `debug` and error details.

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
const SENSITIVE_KEY =
  /(api[-_]?key|secret|token|password|authorization|credential|query|search|term|note|weight|name|brand|calorie|kcal|energy|protein|carb|fat|payload|body|row|url|email)/i;

// Strings that look like credentials in URLs or headers, regardless of the key they sit under.
const SENSITIVE_VALUE = /(api[-_]?key=|x-api-key)/i;

export function redactContext(context: LogContext | undefined): Record<string, LogValue> | undefined {
  if (!context) return undefined;
  const out: Record<string, LogValue> = {};
  for (const [key, value] of Object.entries(context)) {
    const sensitive = SENSITIVE_KEY.test(key) || (typeof value === 'string' && SENSITIVE_VALUE.test(value));
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
    const record: LogRecord = { level, message };
    const safeContext = redactContext(context);
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
