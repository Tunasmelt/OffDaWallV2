import { getClientId, rateLimit } from '@/lib/api-guard';
import { readJsonWithLimit } from '@/lib/request-utils';
import { logger } from '@/lib/logger';
import { respondOk, respondError } from '@/lib/api-response';
import { logEvent } from '@/lib/observability';

export async function POST(request: Request) {
  try {
    const clientId = getClientId(request);
    const limit = rateLimit({ key: `analytics:${clientId}`, limit: 60, windowMs: 60_000 });
    if (!limit.ok) {
      return respondError(
        'rate_limited',
        'Rate limit exceeded',
        { payloadMode: 'preview', providersUsed: [], cache: { hit: false } },
        429
      );
    }

    const bodyResult = await readJsonWithLimit<Record<string, unknown>>(request, 12_000);
    if (!bodyResult.ok) {
      return respondError(
        'invalid_payload',
        bodyResult.error,
        { payloadMode: 'preview', providersUsed: [], cache: { hit: false } },
        400
      );
    }

    const event = bodyResult.data;
    if (!event || typeof event !== 'object') {
      return respondError(
        'invalid_event',
        'Invalid event',
        { payloadMode: 'preview', providersUsed: [], cache: { hit: false } },
        400
      );
    }

    // Log analytics event
    logger.debug('[OffDaWallV2] Analytics event:', event);

    // In production, you would:
    // 1. Store in analytics database
    // 2. Send to analytics service (Google Analytics, Mixpanel, etc.)
    // 3. Process for real-time dashboards

    logEvent('info', '[OffDaWallV2] api/analytics', { success: true });
    return respondOk(
      { message: 'Event tracked successfully' },
      { payloadMode: 'preview', providersUsed: [], cache: { hit: false } }
    );
  } catch (error) {
    logger.error('[OffDaWallV2] Analytics tracking error:', error);
    logEvent('error', '[OffDaWallV2] api/analytics', { success: false, error: `${error}` });
    return respondError(
      'analytics_failed',
      'Failed to track event',
      { payloadMode: 'preview', providersUsed: [], cache: { hit: false } },
      500
    );
  }
}

