type LogLevel = 'info' | 'warn' | 'error';

export function isDebugMode() {
  return process.env.DEBUG_MODE === 'true';
}

export function logEvent(
  level: LogLevel,
  message: string,
  details?: Record<string, unknown>
) {
  const payload = details ? { ...details } : undefined;
  const logger =
    level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;

  if (payload) {
    logger(message, payload);
  } else {
    logger(message);
  }
}
