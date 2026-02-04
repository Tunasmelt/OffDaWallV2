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

export type RouteTrace = {
  route: string;
  requestId: string;
  startedAt: number;
  providerMs: Record<string, number>;
};

export function createRequestId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function startRouteTrace(route: string): RouteTrace {
  return {
    route,
    requestId: createRequestId(),
    startedAt: Date.now(),
    providerMs: {},
  };
}

export function addProviderTiming(trace: RouteTrace, provider: string, durationMs: number) {
  trace.providerMs[provider] = (trace.providerMs[provider] || 0) + durationMs;
}

export function elapsedMs(trace: RouteTrace) {
  return Date.now() - trace.startedAt;
}

export function routeMeta(
  trace: RouteTrace,
  extra?: Record<string, unknown>
): Record<string, unknown> {
  return {
    requestId: trace.requestId,
    durationMs: elapsedMs(trace),
    providerMs: trace.providerMs,
    ...(extra || {}),
  };
}

export function logRouteResult(
  level: LogLevel,
  trace: RouteTrace,
  details?: Record<string, unknown>
) {
  logEvent(level, `[OffDaWallV2] ${trace.route}`, {
    requestId: trace.requestId,
    durationMs: elapsedMs(trace),
    providerMs: trace.providerMs,
    ...(details || {}),
  });
}
