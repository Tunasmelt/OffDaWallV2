import { NextResponse } from 'next/server';
import { apiMonitor } from '@/lib/monitoring';
import { errorLogger } from '@/lib/error-logger';
import { cache } from '@/lib/cache';

export const dynamic = 'force-dynamic';

/**
 * Admin monitoring endpoint
 * Returns system health, API metrics, and error logs
 */
export async function GET() {
  try {
    const apiSummary = apiMonitor.getSummary();
    const rateLimits = apiMonitor.getRateLimitStatus();
    const recentErrors = apiMonitor.getRecentErrors(10);
    const errorSummary = errorLogger.getSummary();
    const recentLogs = errorLogger.getRecentErrors(20);
    const cacheStats = cache.getStats();

    return NextResponse.json({
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
    });
  } catch (error) {
    console.error('[OffDaWallV2] Monitoring endpoint error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch monitoring data' },
      { status: 500 }
    );
  }
}

