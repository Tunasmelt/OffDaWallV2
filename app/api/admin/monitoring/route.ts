import { apiMonitor } from '@/lib/monitoring';
import { errorLogger } from '@/lib/error-logger';
import { cache } from '@/lib/cache';
import { requireAdmin } from '@/lib/api-guard';
import { logger } from '@/lib/logger';
import { respondOk, respondError } from '@/lib/api-response';
import { logRouteResult, routeMeta, startRouteTrace } from '@/lib/observability';
import { getProviderLimiterStatus } from '@/lib/providers/provider-fetch';
import { PROVIDER_LIMITS, type ProviderName } from '@/lib/providers/provider-limits';

export const dynamic = 'force-dynamic';

/**
 * Admin monitoring endpoint
 * Returns system health, API metrics, and error logs
 */
export async function GET(request: Request) {
  const trace = startRouteTrace('api/admin/monitoring');
  try {
    const auth = requireAdmin(request);
    if (!auth.ok) {
      return respondError(
        'unauthorized',
        auth.message || 'Unauthorized',
        { payloadMode: 'preview', providersUsed: [], cache: { hit: false }, ...routeMeta(trace) },
        auth.status
      );
    }

    const apiSummary = apiMonitor.getSummary();
    const rateLimits = apiMonitor.getRateLimitStatus();
    const recentErrors = apiMonitor.getRecentErrors(10);
    const errorSummary = errorLogger.getSummary();
    const recentLogs = errorLogger.getRecentErrors(20);
    const cacheStats = cache.getStats();
    const providerNames: ProviderName[] = [
      'musicbrainz',
      'audiodb',
      'lastfm',
      'deezer',
      'spotify',
      'coverart',
      'archiveorg',
    ];
    const providerLimiters = Object.fromEntries(
      providerNames.map((provider) => [
        provider,
        {
          ...PROVIDER_LIMITS[provider],
          ...getProviderLimiterStatus(provider),
        },
      ])
    );

    const res = respondOk({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      api: {
        summary: apiSummary,
        rateLimits,
        recentErrors,
      },
      errors: {
        summary: errorSummary,
        recentLogs,
      },
      cache: cacheStats,
      providerLimiters,
      system: {
        nodeVersion: process.version,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
      },
    }, {
      payloadMode: 'preview',
      providersUsed: [],
      cache: { hit: false },
      ...routeMeta(trace),
    });
    res.headers.set('Cache-Control', 'no-store, max-age=0');
    res.headers.set('Pragma', 'no-cache');
    logRouteResult('info', trace, { success: true, status: 'ok' });
    return res;
  } catch (error) {
    logger.error('[OffDaWallV2] Monitoring endpoint error:', error);
    logRouteResult('error', trace, { success: false, error: `${error}` });
    return respondError(
      'monitoring_failed',
      'Failed to fetch monitoring data',
      { payloadMode: 'preview', providersUsed: [], cache: { hit: false }, ...routeMeta(trace) },
      500
    );
  }
}

