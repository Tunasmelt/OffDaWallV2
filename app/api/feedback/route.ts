import { getClientId, rateLimit } from '@/lib/api-guard';
import { readJsonWithLimit } from '@/lib/request-utils';
import { logger } from '@/lib/logger';
import { respondOk, respondError } from '@/lib/api-response';
import { logEvent } from '@/lib/observability';

export async function POST(request: Request) {
  try {
    const clientId = getClientId(request);
    const limit = rateLimit({ key: `feedback:${clientId}`, limit: 5, windowMs: 60_000 });
    if (!limit.ok) {
      return respondError(
        'rate_limited',
        'Rate limit exceeded',
        { payloadMode: 'preview', providersUsed: [], cache: { hit: false } },
        429
      );
    }

    const bodyResult = await readJsonWithLimit<{ feedback?: string; timestamp?: number; page?: string }>(
      request,
      10_000
    );
    if (!bodyResult.ok) {
      return respondError(
        'invalid_payload',
        bodyResult.error,
        { payloadMode: 'preview', providersUsed: [], cache: { hit: false } },
        400
      );
    }

    const { feedback, timestamp, page } = bodyResult.data;
    if (!feedback || typeof feedback !== 'string' || feedback.trim().length < 2 || feedback.length > 2000) {
      return respondError(
        'invalid_feedback',
        'Invalid feedback',
        { payloadMode: 'preview', providersUsed: [], cache: { hit: false } },
        400
      );
    }
    if (page && (typeof page !== 'string' || page.length > 200)) {
      return respondError(
        'invalid_page',
        'Invalid page value',
        { payloadMode: 'preview', providersUsed: [], cache: { hit: false } },
        400
      );
    }
    if (timestamp && typeof timestamp !== 'number') {
      return respondError(
        'invalid_timestamp',
        'Invalid timestamp',
        { payloadMode: 'preview', providersUsed: [], cache: { hit: false } },
        400
      );
    }

    // Log feedback to console
    logger.debug('[OffDaWallV2] New feedback received:', {
      feedback,
      page,
      timestamp: timestamp ? new Date(timestamp).toISOString() : new Date().toISOString(),
    });

    // In production, you would:
    // 1. Store in database
    // 2. Send to analytics service
    // 3. Notify team via email/Slack

    logEvent('info', '[OffDaWallV2] api/feedback', { success: true });
    return respondOk(
      { message: 'Feedback received successfully' },
      { payloadMode: 'preview', providersUsed: [], cache: { hit: false } }
    );
  } catch (error) {
    logger.error('[OffDaWallV2] Feedback submission error:', error);
    logEvent('error', '[OffDaWallV2] api/feedback', { success: false, error: `${error}` });
    return respondError(
      'feedback_failed',
      'Failed to submit feedback',
      { payloadMode: 'preview', providersUsed: [], cache: { hit: false } },
      500
    );
  }
}

