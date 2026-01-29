import { apiMonitor } from '@/lib/monitoring';
import { errorLogger } from '@/lib/error-logger';
import { cache } from '@/lib/cache';
import { requireAdmin } from '@/lib/api-guard';
import { logger } from '@/lib/logger';
import { respondOk, respondError } from '@/lib/api-response';
import { logEvent } from '@/lib/observability';

export const dynamic = 'force-dynamic';

/**
 * Admin monitoring endpoint
 * Returns system health, API metrics, and error logs
 */
export async function GET(request: Request) {
  try {
    const auth = requireAdmin(request);
    if (!auth.ok) {
      return respondError(
        'unauthorized',
        auth.message || 'Unauthorized',
        { payloadMode: 'preview', providersUsed: [], cache: { hit: false } },
        auth.status
      );
    }

    const apiSummary = apiMonitor.getSummary();
    const rateLimits = apiMonitor.getRateLimitStatus();
    const recentErrors = apiMonitor.getRecentErrors(10);
    const errorSummary = errorLogger.getSummary();
    const recentLogs = errorLogger.getRecentErrors(20);
    const cacheStats = cache.getStats();

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
      system: {
        nodeVersion: process.version,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
      },
    }, {
      payloadMode: 'preview',
      providersUsed: [],
      cache: { hit: false },
    });
    res.headers.set('Cache-Control', 'no-store, max-age=0');
    res.headers.set('Pragma', 'no-cache');
    logEvent('info', '[OffDaWallV2] api/admin/monitoring', { success: true });
    return res;
  } catch (error) {
    logger.error('[OffDaWallV2] Monitoring endpoint error:', error);
    logEvent('error', '[OffDaWallV2] api/admin/monitoring', { success: false, error: `${error}` });
    return respondError(
      'monitoring_failed',
      'Failed to fetch monitoring data',
      { payloadMode: 'preview', providersUsed: [], cache: { hit: false } },
      500
    );
  }
}

