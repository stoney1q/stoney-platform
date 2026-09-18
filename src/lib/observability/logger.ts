/**
 * Centralized Observability & Error Tracking facade.
 * Outputs human-readable logs in development, and structured JSON logs in production
 * that are automatically parsed by GCP/Vercel/AWS CloudWatch.
 */

// Keys that should never be logged
const SENSITIVE_KEYS = new Set([
  'password',
  'secret',
  'token',
  'authorization',
  'signature',
  'cookie',
  'paystack_secret_key',
  'portaltoken',
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sanitizeValue(key: string, value: unknown): unknown {
  if (SENSITIVE_KEYS.has(key.toLowerCase())) {
    return '[REDACTED]';
  }

  if (isPlainObject(value)) {
    return sanitizeContext(value);
  }

  if (Array.isArray(value)) {
    return value.map((v) => sanitizeValue(key, v));
  }

  return value;
}

export function sanitizeContext(
  context: Record<string, unknown>
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(context)) {
    sanitized[key] = sanitizeValue(key, value);
  }
  return sanitized;
}

function formatError(error: unknown): Record<string, unknown> | string {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      // Do not expose stack traces in logs unless in development
      stack: process.env.NODE_ENV === 'production' ? undefined : error.stack,
    };
  }
  return String(error);
}

type LogLevel = 'info' | 'warn' | 'error';

function log(
  level: LogLevel,
  message: string,
  context?: Record<string, unknown>,
  error?: unknown
) {
  const isProd = process.env.NODE_ENV === 'production';
  const timestamp = new Date().toISOString();

  const finalContext = context ? sanitizeContext(context) : {};
  if (error !== undefined) {
    finalContext.error = formatError(error);
  }

  if (isProd) {
    // Structured JSON logging for cloud aggregators
    const logPayload = {
      timestamp,
      level,
      message,
      ...finalContext,
    };

    // In production, console functions are usually captured by the standard out stream.
    if (level === 'error') {
      console.error(JSON.stringify(logPayload));
    } else if (level === 'warn') {
      console.warn(JSON.stringify(logPayload));
    } else {
      console.info(JSON.stringify(logPayload));
    }
  } else {
    // Human readable for development
    const ctxString =
      Object.keys(finalContext).length > 0
        ? `\nContext: ${JSON.stringify(finalContext, null, 2)}`
        : '';
    const formatted = `[${timestamp}] ${level.toUpperCase()}: ${message}${ctxString}`;

    if (level === 'error') {
      console.error(formatted);
    } else if (level === 'warn') {
      console.warn(formatted);
    } else {
      console.info(formatted);
    }
  }
}

export const logger = {
  info: (message: string, context?: Record<string, unknown>) =>
    log('info', message, context),
  warn: (message: string, context?: Record<string, unknown>) =>
    log('warn', message, context),
  error: (
    message: string,
    error?: unknown,
    context?: Record<string, unknown>
  ) => log('error', message, context, error),
};
