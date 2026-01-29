import { NextRequest } from 'next/server';
import { resolveArtistImage } from '@/lib/services/image-resolver';
import { getClientId, rateLimit } from '@/lib/api-guard';
import { respondOk, respondError } from '@/lib/api-response';
import { logEvent } from '@/lib/observability';

export async function GET(request: NextRequest) {
  try {
    const clientId = getClientId(request);
    const limit = rateLimit({ key: `artist-image:${clientId}`, limit: 40, windowMs: 60_000 });
    if (!limit.ok) {
      return respondError(
        'rate_limited',
        'Rate limit exceeded',
        { payloadMode: 'preview', providersUsed: [], cache: { hit: false } },
        429
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const mbid = searchParams.get('mbid') || '';
    const name = searchParams.get('name') || '';

    if (!mbid && !name) {
      return respondError(
        'missing_params',
        'mbid or name is required',
        { payloadMode: 'preview', providersUsed: [], cache: { hit: false } },
        400
      );
    }

    const resolved = await resolveArtistImage({ mbid, name });
    const response = respondOk(
      { imageUrl: resolved.imageUrl, source: resolved.source, confidence: resolved.confidence, license: resolved.license },
      {
        payloadMode: 'preview',
        providersUsed: resolved.source ? [resolved.source] : [],
        cache: { hit: false },
      }
    );
    response.headers.set('Cache-Control', 'public, s-maxage=604800, stale-while-revalidate=2592000');
    return response;
  } catch (error) {
    logEvent('error', '[OffDaWallV2] api/artist-image', { success: false, error: `${error}` });
    return respondError(
      'artist_image_failed',
      'Failed to fetch artist image',
      { payloadMode: 'preview', providersUsed: [], cache: { hit: false } },
      500
    );
  }
}
